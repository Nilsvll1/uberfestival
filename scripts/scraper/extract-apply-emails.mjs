/**
 * B1 — Application Email Extractor
 *
 * Crawls every festival website (+ contact/booking sub-pages) and extracts
 * booking/application email addresses. Stores the best match in
 * festivals.application_email. This gives Premium users a direct "Apply by
 * email" path when no structured form or platform link exists.
 *
 * Scoring tiers:
 *   Tier 1 (0.88) — bookings@, bands@, artists@, talent@, apply@, entries@,
 *                    submissions@, performers@
 *   Tier 2 (0.74) — programming@, programme@, program@, music@submissions,
 *                    livemusic@, opencall@
 *   Tier 3 (0.62) — info@, contact@, hello@, music@ — only kept if page
 *                    context strongly signals application intent
 *   Rejected       — press@, pr@, media@, sponsor@, tickets@, support@,
 *                    noreply@, jobs@, volunteers@, legal@, marketing@
 *
 * Usage:
 *   node --env-file=.env extract-apply-emails.mjs
 *   node --env-file=.env extract-apply-emails.mjs --dry-run
 *   node --env-file=.env extract-apply-emails.mjs --limit=50
 *   node --env-file=.env extract-apply-emails.mjs --id=42
 */

import { db }        from "./lib/supabase.mjs";
import { fetchPage } from "./lib/fetch-page.mjs";

const args     = process.argv.slice(2);
const DRY_RUN  = args.includes("--dry-run");
const limitArg = parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0", 10);
const idArg    = parseInt(args.find((a) => a.startsWith("--id="))?.split("=")[1]    ?? "0", 10);

const CONCURRENCY  = 3;
const FETCH_DELAY  = 900;
const MIN_CONF     = 0.60;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Email classification ──────────────────────────────────────────────────────

// These prefixes on their own are sufficient evidence of an application email.
const TIER_1 = new Set([
  "bookings", "booking", "bands", "band", "artists", "artist",
  "talent", "apply", "applications", "application",
  "entries", "entry", "submissions", "submit", "submission",
  "opensubmissions", "opencall", "open-call",
  "performers", "performer", "acts", "liveacts",
  "artistbooking", "bandbooking", "livebooking",
  "musicbooking", "artistsubmissions", "bandsubmissions",
]);

// These need supporting page context (apply-related keywords on the page).
const TIER_2 = new Set([
  "programming", "programme", "program",
  "livemusic", "live-music", "liveshows",
  "music", "shows", "performance", "stage",
]);

// These are kept only if page context is very strong (multiple apply signals).
const TIER_3 = new Set([
  "info", "contact", "hello", "general", "team", "festival", "office",
]);

// Always rejected regardless of context.
const REJECT = new Set([
  "press", "pr", "media", "sponsorship", "sponsor", "sponsors",
  "marketing", "noreply", "no-reply", "support", "admin", "webmaster",
  "newsletter", "social", "tickets", "ticketing", "merchandise", "merch",
  "shop", "volunteer", "volunteers", "legal", "finance", "accounts",
  "jobs", "careers", "recruitment", "accessibility", "complaints",
  "feedback", "partners", "partnership", "advertising",
]);

// File-extension suffixes that appear after @ in image/asset paths — not real emails.
const FAKE_EMAIL_RE = /@[^@]*\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|json|xml|mp3|mp4|woff|ttf|pdf|zip|mov|avi|eot|otf)\b/i;

function getFestivalDomain(website) {
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch { return null; }
}

function classifyEmail(address, pageApplyScore, festivalDomain) {
  // Reject image/asset paths that accidentally match the email regex
  if (FAKE_EMAIL_RE.test(address)) return null;

  const [prefix, domain] = address.toLowerCase().split("@");
  if (!prefix || !domain) return null;

  const root = prefix.replace(/[._\-+0-9]/g, "");

  if (REJECT.has(root) || REJECT.has(prefix)) return null;

  // Does this email come from the festival's own domain?
  const isOwnDomain = Boolean(
    festivalDomain && (domain === festivalDomain || domain.endsWith("." + festivalDomain)),
  );

  if (TIER_1.has(root) || TIER_1.has(prefix)) return 0.88;

  // Compound matches: "musicsubmissions@", "livetalent@", etc.
  for (const t1 of TIER_1) {
    if (root.includes(t1) || prefix.includes(t1)) return 0.85;
  }

  if (TIER_2.has(root) || TIER_2.has(prefix)) {
    if (pageApplyScore >= 2) return 0.74;
    if (isOwnDomain) return 0.65;
    return null;
  }

  if (TIER_3.has(root) || TIER_3.has(prefix)) {
    // Own-domain contact/info emails are first-party contacts — lower threshold.
    if (isOwnDomain) return pageApplyScore >= 1 ? 0.64 : 0.61;
    // Third-party (gmail, etc.) needs strong apply context to be useful.
    return pageApplyScore >= 3 ? 0.62 : null;
  }

  return null;
}

// ── Apply-context scoring for a page ─────────────────────────────────────────

const APPLY_KEYWORDS = [
  /\bapply\b/i, /\bapplication\b/i, /\bsubmit\b/i, /\bsubmission\b/i,
  /open.call\b/i, /call.for.entr/i, /call.for.artist/i,
  /\baudition/i, /\bperform\b/i, /\bbooking enquir/i,
  /want to play/i, /play at/i, /perform at/i,
  /\bband enquir/i, /\bartist enquir/i,
];

function pageApplyScore(text) {
  return APPLY_KEYWORDS.filter((p) => p.test(text)).length;
}

// ── Email extraction ──────────────────────────────────────────────────────────

// Handles plain text, href="mailto:...", and common obfuscations
const EMAIL_RE = /\b([a-zA-Z0-9._%+\-]{1,40}@[a-zA-Z0-9.\-]{1,60}\.[a-zA-Z]{2,10})\b/g;

function extractEmails(html) {
  if (!html) return [];

  // Decode common obfuscations before scanning
  const deobfuscated = html
    .replace(/\[at\]/gi, "@")
    .replace(/\(at\)/gi, "@")
    .replace(/&#64;/g, "@")
    .replace(/\s+at\s+(?=[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g, "@");

  const found = new Set();
  let m;
  while ((m = EMAIL_RE.exec(deobfuscated)) !== null) {
    const email = m[1].toLowerCase().trim();
    // Basic sanity: must have a real TLD-length suffix
    if (email.length > 5 && email.includes(".")) {
      found.add(email);
    }
  }
  return [...found];
}

// ── Contact page discovery ────────────────────────────────────────────────────

const CONTACT_HREF = /contact|booking|apply|submit|artists?|bands?|perform|talent|open.call|showcas/i;
const CONTACT_TEXT = /contact|booking|apply|submit|artists?|bands?|perform|talent|open call|showcas/i;

function findContactLinks(html, baseUrl) {
  const links = [];
  const linkRe = /<a\s[^>]*href=["']([^"'#][^"']*?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    const [, href, rawText] = m;
    const text = rawText.replace(/<[^>]+>/g, "").trim();
    if (!CONTACT_HREF.test(href) && !CONTACT_TEXT.test(text)) continue;
    try {
      const abs = new URL(href, baseUrl).href;
      // Only follow links on the same domain
      if (new URL(abs).hostname !== new URL(baseUrl).hostname) continue;
      links.push({ url: abs, score: (CONTACT_HREF.test(href) ? 2 : 0) + (CONTACT_TEXT.test(text) ? 1 : 0) });
    } catch {}
  }
  // Deduplicate and return top 3 by score
  const seen = new Set();
  return links
    .filter((l) => { if (seen.has(l.url)) return false; seen.add(l.url); return true; })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

// ── Per-festival extraction ───────────────────────────────────────────────────

async function extractForFestival(festival) {
  const website = festival.website?.startsWith("http")
    ? festival.website
    : festival.website ? `https://${festival.website}` : null;

  if (!website) return null;

  const candidates = []; // { email, confidence, source }

  // --- Page 1: Homepage ---
  const home = await fetchPage(website, { retries: 1, timeoutMs: 12_000 });
  if (!home.html && !home.status) return null; // dead site

  const homeText  = (home.html ?? "").replace(/<[^>]+>/g, " ");
  const homeScore = pageApplyScore(homeText);
  const homeEmails = extractEmails(home.html ?? "");

  const festivalDomain = getFestivalDomain(website);

  for (const email of homeEmails) {
    const conf = classifyEmail(email, homeScore, festivalDomain);
    if (conf) candidates.push({ email, confidence: conf, source: website });
  }

  // --- Pages 2-4: Contact/booking sub-pages ---
  const contactLinks = findContactLinks(home.html ?? "", website);

  for (const link of contactLinks) {
    if (link.url === website) continue;
    const page = await fetchPage(link.url, { retries: 0, timeoutMs: 10_000 });
    if (!page.html) continue;

    const pageText   = page.html.replace(/<[^>]+>/g, " ");
    const pScore     = pageApplyScore(pageText);
    const pageEmails = extractEmails(page.html);

    for (const email of pageEmails) {
      const conf = classifyEmail(email, Math.max(homeScore, pScore), festivalDomain);
      if (conf) candidates.push({ email, confidence: conf, source: link.url });
    }
  }

  if (!candidates.length) return null;

  // Pick the highest-confidence, deduplicated best email
  const best = candidates.reduce((a, b) => b.confidence > a.confidence ? b : a);
  if (best.confidence < MIN_CONF) return null;

  return best;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(68)}`);
console.log(`  UberFestival — Application Email Extractor (B1)`);
console.log(`  ${new Date().toISOString()}${DRY_RUN ? "  [DRY RUN]" : ""}`);
console.log(`${"═".repeat(68)}\n`);

// Load targets: no application_url, no application_email yet, has website
let query = db
  .from("festivals")
  .select("id, festival_name, country, website")
  .is("application_url", null)
  .is("application_email", null)
  .not("website", "is", null)
  .eq("is_archived", false)
  .order("id");

if (idArg) query = db.from("festivals").select("id, festival_name, country, website").eq("id", idArg);
if (limitArg && !idArg) query = query.limit(limitArg);

const { data: festivals, error: queryErr } = await query;
if (queryErr) { console.error("[FATAL] Query failed:", queryErr.message); process.exit(1); }
if (!festivals?.length) { console.log("  No targets — all festivals already have an application path."); process.exit(0); }

console.log(`  Targets: ${festivals.length} festivals\n`);

let found = 0, skipped = 0, dbErrors = 0;
const byConf = { high: 0, mid: 0, low: 0 };

for (let i = 0; i < festivals.length; i += CONCURRENCY) {
  const batch = festivals.slice(i, i + CONCURRENCY);

  await Promise.all(batch.map(async (festival) => {
    const label = `[${festival.id}] ${festival.festival_name.slice(0, 42).padEnd(42)}`;

    let result;
    try {
      result = await extractForFestival(festival);
    } catch (err) {
      console.log(`  ✗ ${label} ERROR: ${err.message.slice(0, 60)}`);
      return;
    }

    if (!result) {
      console.log(`  — ${label} no email found`);
      skipped++;
      return;
    }

    const tier = result.confidence >= 0.85 ? "high" : result.confidence >= 0.70 ? "mid" : "low";
    byConf[tier]++;
    found++;

    console.log(`  ✓ ${label} ${result.email}  (conf=${result.confidence.toFixed(2)})`);

    if (DRY_RUN) return;

    const { error } = await db.from("festivals").update({
      application_email:      result.email,
      application_source:     "email_extraction",
      application_confidence: result.confidence,
      application_verified_at: new Date().toISOString(),
    }).eq("id", festival.id);

    if (error) {
      console.warn(`    [warn] DB write failed: ${error.message}`);
      dbErrors++;
      found--;
    }
  }));

  if (i + CONCURRENCY < festivals.length) await sleep(FETCH_DELAY);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(68)}`);
console.log(`  RESULTS`);
console.log(`${"═".repeat(68)}`);
console.log(`  Processed:    ${festivals.length}`);
console.log(`  Emails found: ${found}  (${((found / festivals.length) * 100).toFixed(1)}% hit rate)`);
console.log(`  No email:     ${skipped}`);
console.log(`  DB errors:    ${dbErrors}`);
console.log(`\n  Confidence breakdown:`);
console.log(`    High (≥0.85): ${byConf.high}`);
console.log(`    Mid  (≥0.70): ${byConf.mid}`);
console.log(`    Low  (≥0.60): ${byConf.low}`);
console.log(`${"═".repeat(68)}\n`);
