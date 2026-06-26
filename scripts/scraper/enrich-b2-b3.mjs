/**
 * B2 + B3 — Exhaustive multi-source enrichment for unknown festivals.
 *
 * Targets every festival with booking_model = 'unknown' and no application path.
 * Runs a significantly more aggressive discovery stack than the initial enricher:
 *
 *   1. FilmFreeway — 9 slug variations per festival
 *   2. Festhome    — 6 slug variations per festival
 *   3. Deep website crawl — homepage + up to 5 apply-related sub-pages
 *   4. 55-path URL guessing on the festival's own domain
 *
 * Usage:
 *   node --env-file=.env enrich-b2-b3.mjs
 *   node --env-file=.env enrich-b2-b3.mjs --dry-run
 *   node --env-file=.env enrich-b2-b3.mjs --limit=50
 *   node --env-file=.env enrich-b2-b3.mjs --id=42
 */

import { db }        from "./lib/supabase.mjs";
import { fetchPage } from "./lib/fetch-page.mjs";

const args     = process.argv.slice(2);
const DRY_RUN  = args.includes("--dry-run");
const limitArg = parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0", 10);
const idArg    = parseInt(args.find((a) => a.startsWith("--id="))?.split("=")[1]    ?? "0", 10);

const CONCURRENCY = 3;
const DELAY_MS    = 1_000;
const UA = "Mozilla/5.0 (compatible; UberFestivalBot/1.0; +https://uberfestival.com)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// AbortController-based fetch with timeout — actually cancels the request
async function fetchTO(url, opts = {}, timeoutMs = 6_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── Slug generation ───────────────────────────────────────────────────────────

function slugs(name) {
  const base = name.toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const variants = new Set([
    base,
    base.replace(/-festival$/, ""),
    base.replace(/-music-festival$/, ""),
    base.replace(/-jazz-festival$/, ""),
    base.replace(/-film-festival$/, ""),
    base.replace(/-open-air$/, ""),
    base.replace(/-international$/, ""),
    base.replace(/^the-/, ""),
    base.replace(/-/g, ""),
  ]);
  return [...variants].filter(Boolean);
}

// ── Platform checks ───────────────────────────────────────────────────────────

// Generic/redirect pages on FilmFreeway that indicate a miss
const FF_GENERIC_RE = /filmfreeway\.com\/(search|festivals|categories|browse|discover|home)?(\?|\/?\s*$)/i;

async function checkFilmFreeway(festival) {
  for (const s of slugs(festival.festival_name)) {
    const url = `https://filmfreeway.com/${s}`;
    try {
      const res = await fetchTO(url, { headers: { "User-Agent": UA }, redirect: "follow" }, 6_000);
      if (!res.ok || !res.url.includes("filmfreeway.com/")) continue;
      // Reject generic pages (homepage, search, browse, etc.)
      if (FF_GENERIC_RE.test(res.url)) continue;
      const html = await res.text();
      if (!nameOnPage(html, festival.festival_name)) continue;
      return { url: res.url, platform: "filmfreeway", confidence: 0.88, source: "filmfreeway_b2" };
    } catch { continue; }
  }
  return null;
}

// Festhome URL format: festhome.com/festival/SLUG or festhome.com/SLUG
// filmmakers.festhome.com is a different product (film submissions, not live music).
// We try both subdomains and several slug formats.
const FESTHOME_GENERIC_RE = /\/festivals?\/?$|filmmakers\.festhome\.com\/festivals/i;

async function checkFesthome(festival) {
  const allSlugs = slugs(festival.festival_name);
  const attempts = [
    ...allSlugs.map((s) => `https://festhome.com/festival/${s}`),
    ...allSlugs.map((s) => `https://festhome.com/${s}`),
  ];

  for (const url of attempts) {
    try {
      const res = await fetchTO(url, { headers: { "User-Agent": UA }, redirect: "follow" }, 6_000);
      if (!res.ok) continue;
      // Reject redirects to generic Festhome pages
      if (FESTHOME_GENERIC_RE.test(res.url)) continue;
      // Must land on a specific page (not the same generic URL)
      if (res.url === "https://festhome.com/" || res.url === "https://festhome.com") continue;
      const html = await res.text();
      if (!nameOnPage(html, festival.festival_name)) continue;
      return { url: res.url, platform: "festhome", confidence: 0.86, source: "festhome_b3" };
    } catch { continue; }
  }
  return null;
}

// ── URL guessing — top 15 paths, checked in parallel ─────────────────────────
// These survived as the highest-yield paths after the first enrichment run.
// Checked in parallel in groups of 5 to keep per-festival time bounded.

const GUESS_PATHS = [
  "/apply", "/applications", "/submission", "/submissions",
  "/open-call", "/call-for-entries", "/call-for-artists",
  "/for-artists", "/artists/apply",
  "/submit", "/auditions",
  "/perform", "/booking",
  "/register", "/entries",
];

async function guessUrl(festival, baseUrl) {
  const origin = new URL(baseUrl).origin;

  // Check all paths in parallel, cap each at 4s
  const results = await Promise.all(
    GUESS_PATHS.map(async (path) => {
      try {
        const res = await fetchTO(
          origin + path,
          { method: "HEAD", headers: { "User-Agent": UA }, redirect: "follow" },
          4_000,
        );
        if (!res.ok) return null;
        return res.url ?? origin + path;
      } catch { return null; }
    }),
  );

  const festivalHost = new URL(baseUrl).hostname.replace(/^www\./, "");
  const STALE_RE = /\/(news|blog|press|archive|post|article|media)(\/|$)/i;
  const BAD_PATH_RE = /\/ticket(s|ing|-office)?|\/buy|\/shop(\/|$)|\/store(\/|$)/i;

  for (const url of results.filter(Boolean)) {
    if (STALE_RE.test(url) || BAD_PATH_RE.test(url)) continue;

    // If the redirect landed on a completely different domain, only accept it
    // when it's a known platform (filmfreeway, typeform, etc.)
    const resultHost = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; } })();
    const isFestivalDomain = resultHost === festivalHost || resultHost?.endsWith("." + festivalHost);
    if (!isFestivalDomain && detectPlatform(url) === "official") continue;

    const confirmed = await confirmApplyPage(url, festival.festival_name);
    if (confirmed) return { ...confirmed, source: `url_guess` };
  }
  return null;
}

// ── Deep website crawl ────────────────────────────────────────────────────────

const APPLY_URL_RE  = /\/apply|\/applications?|\/submit|\/call-for-|\/open-call|\/entries|\/audition|\/for-artists|\/for-bands|\/perform|\/booking/i;
const APPLY_TEXT_RE = /\bapply\b|\bapplication\b|\bsubmit\b|\bopen.call\b|\bcall.for\b|\baudition\b|\bperform\b|\bbooking\b/i;
const PLATFORM_RE   = /filmfreeway\.com|festhome\.com|submittable\.com|jotform\.com|typeform\.com|docs\.google\.com\/forms|eventival\.com|wufoo\.com|formstack\.com|airtable\.com\/shr/i;

function scoreLink(href, text) {
  let score = 0;
  if (APPLY_URL_RE.test(href))  score += 20;
  if (APPLY_TEXT_RE.test(text)) score += 15;
  if (PLATFORM_RE.test(href))   score += 30;
  return score;
}

function extractLinks(html, baseUrl) {
  const links = [];
  const re = /<a\s[^>]*href=["']([^"'#][^"']*?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const [, href, rawText] = m;
    const text = rawText.replace(/<[^>]+>/g, "").trim();
    const score = scoreLink(href, text);
    if (score < 15) continue;
    try {
      const abs = new URL(href, baseUrl).href;
      links.push({ url: abs, score, isPlatform: PLATFORM_RE.test(abs) });
    } catch {}
  }
  // Sort by score, deduplicate
  const seen = new Set();
  return links
    .sort((a, b) => b.score - a.score)
    .filter(({ url }) => { if (seen.has(url)) return false; seen.add(url); return true; })
    .slice(0, 5);
}

async function deepCrawl(festival, baseUrl) {
  const { html: homeHtml } = await fetchPage(baseUrl, { retries: 0, timeoutMs: 10_000 });
  if (!homeHtml) return null;

  const links = extractLinks(homeHtml, baseUrl);

  // Platform links found directly on homepage
  for (const link of links.filter((l) => l.isPlatform)) {
    if (nameOnPage(link.url, festival.festival_name)) {
      return { url: link.url, platform: detectPlatform(link.url), confidence: 0.88, source: "homepage_platform" };
    }
    // Just return it — it's a platform link, trust it
    return { url: link.url, platform: detectPlatform(link.url), confidence: 0.80, source: "homepage_platform" };
  }

  const CRAWL_BAD_RE = /\/ticket(s|ing|-office)?|\/buy|\/shop(\/|$)|\/store(\/|$)|\/media(\/|$)|\/press(\/|$)|\/news\//i;

  // Follow apply-related internal links (up to 5)
  for (const link of links.filter((l) => !l.isPlatform)) {
    try {
      if (new URL(link.url).hostname !== new URL(baseUrl).hostname) continue;
    } catch { continue; }
    if (CRAWL_BAD_RE.test(link.url)) continue;

    const confirmed = await confirmApplyPage(link.url, festival.festival_name);
    if (confirmed) return { ...confirmed, source: `crawl:${link.url}` };
  }

  return null;
}

// ── Confirmation ──────────────────────────────────────────────────────────────

const CONFIRM_KEYWORDS = [
  /apply\s+now/i, /\bapplication\b/i, /\bsubmit\b/i, /\bsubmission\b/i,
  /call.for.entr/i, /call.for.artists?/i, /open.call/i, /\baudition/i,
  /\bentry\s+form\b/i, /\bregistration\s+form\b/i, /how\s+to\s+apply/i,
  /\bperform\s+at\b/i, /\bplay\s+at\b/i, /want\s+to\s+perform/i,
];

// URL patterns that signal a bad confirmation target (ticket pages, media sections, etc.)
const BAD_CONFIRM_RE = /\/ticket(s|ing|-office)?|\/buy(-tickets)?|\/shop(\/|$)|\/store(\/|$)|\/media(\/|$)|\/press(\/|$)|\/news\/|\/(2\d{3})\//i;

async function confirmApplyPage(url, festivalName) {
  // Reject obviously wrong page types before fetching
  if (BAD_CONFIRM_RE.test(url)) return null;

  const { html, status } = await fetchPage(url, { retries: 0, timeoutMs: 10_000 });
  if (!html || !status) return null;

  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 8_000);
  const hits = CONFIRM_KEYWORDS.filter((p) => p.test(text)).length;
  const hasForm = /<form\b/i.test(html);
  const platform = detectPlatform(url);

  if (hits === 0 && !hasForm && platform === "official") return null;

  const confidence = platform !== "official" ? 0.88
    : hasForm && hits >= 2 ? 0.82
    : hasForm || hits >= 2 ? 0.72
    : null; // reject single-keyword or keyword-only with no form

  if (!confidence) return null;

  return { url, platform, confidence };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectPlatform(url) {
  const map = [
    [/filmfreeway\.com/, "filmfreeway"],
    [/festhome\.com/, "festhome"],
    [/submittable\.com/, "submittable"],
    [/jotform\.com/, "jotform"],
    [/typeform\.com/, "typeform"],
    [/docs\.google\.com\/forms/, "google_forms"],
    [/eventival\.com/, "eventival"],
    [/wufoo\.com/, "wufoo"],
    [/formstack\.com/, "formstack"],
    [/airtable\.com\/shr/, "airtable"],
  ];
  for (const [re, name] of map) if (re.test(url)) return name;
  return "official";
}

// Words too generic to distinguish a festival name match
const GENERIC_WORDS = new Set([
  "festival", "music", "open", "live", "rock", "jazz", "folk", "blues",
  "summer", "winter", "annual", "international", "world", "arts", "film",
  "culture", "street", "city", "national", "the", "and", "for",
]);

function nameOnPage(html, name) {
  if (!name || !html) return false;
  const text = (typeof html === "string" ? html : "").toLowerCase();
  // Prefer distinctive words (len > 4, not generic)
  const distinctive = name.toLowerCase().split(/\s+/)
    .filter((w) => w.length > 4 && !GENERIC_WORDS.has(w));
  if (distinctive.length) return distinctive.some((w) => text.includes(w));
  // Fall back to any word >= 3 chars (handles short names like "The Fest")
  const anyWord = name.toLowerCase().split(/\s+/).filter((w) => w.length >= 3 && !GENERIC_WORDS.has(w));
  if (anyWord.length) return anyWord.some((w) => text.includes(w));
  // Name is entirely generic words — require slug in URL instead
  return false;
}

function normalizeUrl(website) {
  if (!website) return null;
  return website.startsWith("http") ? website : `https://${website}`;
}

// ── Per-festival enrichment ───────────────────────────────────────────────────

async function enrich(festival) {
  const baseUrl = normalizeUrl(festival.website);

  // 1. FilmFreeway
  const ff = await checkFilmFreeway(festival);
  if (ff) return ff;

  // 2. Festhome
  const fh = await checkFesthome(festival);
  if (fh) return fh;

  if (!baseUrl) return null;

  // 3. Deep crawl
  const crawl = await deepCrawl(festival, baseUrl);
  if (crawl) return crawl;

  // 4. URL guessing
  const guess = await guessUrl(festival, baseUrl);
  if (guess) return guess;

  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(68)}`);
console.log(`  UberFestival — B2 + B3 Exhaustive Enrichment`);
console.log(`  ${new Date().toISOString()}${DRY_RUN ? "  [DRY RUN]" : ""}`);
console.log(`${"═".repeat(68)}\n`);

let query = db
  .from("festivals")
  .select("id, festival_name, category, country, website, application_url, application_email")
  .eq("booking_model", "unknown")
  .is("application_url", null)
  .is("application_email", null)
  .eq("is_archived", false)
  .order("id");

if (idArg)    query = db.from("festivals").select("id, festival_name, category, country, website, application_url, application_email").eq("id", idArg);
if (limitArg && !idArg) query = query.limit(limitArg);

const { data: festivals, error: qErr } = await query;
if (qErr)         { console.error("[FATAL]", qErr.message); process.exit(1); }
if (!festivals?.length) { console.log("  No targets remaining."); process.exit(0); }

console.log(`  Targets: ${festivals.length} unknown festivals\n`);

let found = 0, skipped = 0, dbErrors = 0;
const byPlatform = {}, bySource = {};

for (let i = 0; i < festivals.length; i += CONCURRENCY) {
  const batch = festivals.slice(i, i + CONCURRENCY);

  await Promise.all(batch.map(async (festival) => {
    const label = `[${String(festival.id).padStart(4)}] ${festival.festival_name.slice(0, 44).padEnd(44)}`;
    process.stdout.write(`  … ${label} checking\r`);

    let result;
    try {
      result = await enrich(festival);
    } catch (err) {
      console.log(`  ✗ ${label} ERROR: ${err.message.slice(0, 60)}`);
      return;
    }

    if (!result) {
      skipped++;
      return;
    }

    found++;
    byPlatform[result.platform] = (byPlatform[result.platform] ?? 0) + 1;
    const src = result.source?.split(":")[0] ?? "unknown";
    bySource[src] = (bySource[src] ?? 0) + 1;

    console.log(`  ✓ ${label} [${result.platform.padEnd(12)}] conf=${result.confidence.toFixed(2)}  ${result.url.slice(0, 60)}`);

    if (DRY_RUN) return;

    const { error } = await db.from("festivals").update({
      application_url:         result.url,
      application_platform:    result.platform,
      application_source:      result.source,
      application_confidence:  result.confidence,
      application_verified_at: new Date().toISOString(),
      booking_model:           "open_call",
      link_check_status:       "unchecked",
    }).eq("id", festival.id);

    if (error) {
      console.warn(`    [warn] DB write failed: ${error.message}`);
      dbErrors++;
      found--;
    }
  }));

  if (i + CONCURRENCY < festivals.length) await sleep(DELAY_MS);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(68)}`);
console.log(`  RESULTS`);
console.log(`${"═".repeat(68)}`);
console.log(`  Processed: ${festivals.length}  |  Found: ${found}  |  No path: ${skipped}  |  Errors: ${dbErrors}`);
console.log(`  Hit rate:  ${((found / festivals.length) * 100).toFixed(1)}%`);

if (Object.keys(byPlatform).length) {
  console.log(`\n  By platform:`);
  Object.entries(byPlatform).sort((a, b) => b[1] - a[1]).forEach(([p, n]) =>
    console.log(`    ${p.padEnd(16)} ${n}`));
}
if (Object.keys(bySource).length) {
  console.log(`\n  By source:`);
  Object.entries(bySource).sort((a, b) => b[1] - a[1]).forEach(([s, n]) =>
    console.log(`    ${s.padEnd(24)} ${n}`));
}

if (!DRY_RUN) {
  // Updated coverage
  const [openRes, denomRes] = await Promise.all([
    db.from("festivals").select("id", { count: "exact", head: true }).eq("booking_model", "open_call").eq("is_archived", false),
    db.from("festivals").select("id", { count: "exact", head: true }).neq("booking_model", "invitation_only").eq("is_archived", false),
  ]);
  const open  = openRes.count ?? 0;
  const denom = denomRes.count ?? 0;
  console.log(`\n  Coverage: ${open} / ${denom} = ${((open / denom) * 100).toFixed(1)}%  (target 80%)`);
}

console.log(`${"═".repeat(68)}\n`);
