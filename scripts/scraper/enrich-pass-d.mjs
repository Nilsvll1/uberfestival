/**
 * Pass D — Contact extraction → contact_submission
 *
 * For every remaining unknown festival (with website, no application path found),
 * extracts the best available contact path:
 *
 *   Priority 1: Programming/booking email on website
 *   Priority 2: Generic contact email
 *   Priority 3: Contact form URL (/contact page)
 *   Priority 4: Instagram handle (stored separately)
 *
 * Sets application_status = 'contact_submission' so users know they can
 * reach out — even if it's not a direct application portal.
 *
 * Does NOT set booking_model = 'open_call'. These festivals are unknown
 * in terms of whether they accept applications at all.
 *
 * Usage:
 *   node --env-file=.env enrich-pass-d.mjs
 *   node --env-file=.env enrich-pass-d.mjs --dry-run
 *   node --env-file=.env enrich-pass-d.mjs --limit=200
 */

import { db }        from "./lib/supabase.mjs";
import { fetchPage } from "./lib/fetch-page.mjs";

const args     = process.argv.slice(2);
const DRY_RUN  = args.includes("--dry-run");
const limitArg = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "0", 10);
const idArg    = parseInt(args.find(a => a.startsWith("--id="))?.split("=")[1]    ?? "0", 10);

const CONCURRENCY = 5;
const DELAY_MS    = 800;
const sleep       = ms => new Promise(r => setTimeout(r, ms));

// ── Email extraction ──────────────────────────────────────────────────────────

// Matches email addresses in HTML (including obfuscated formats)
const EMAIL_RE = /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g;

// Emails that are almost certainly not useful
const EMAIL_BLACKLIST = /ticket|sales|box-?office|webmaster|noreply|no-reply|info@info|admin@|support@|accounts@|billing@|press@media|marketing@|newsletter@|unsubscribe@|spam@|abuse@|postmaster@/i;

// Domain/placeholder email hosts to reject entirely
const DOMAIN_BLACKLIST = /\.(domains?|seo|example|test|placeholder|sample|demo|spam|temp)\.|@(example|test|placeholder|domain|youremail|yourname|email)\.|sposti\.fi$|@esimerkki\.|@example\./i;

// Strong signals: these prefixes suggest a programming/booking contact
const BOOKING_SIGNAL = /^(booking|programme|programming|lineup|artists?|bands|performers?|music|talent|acts|submissions?|entries|apply|applications?|curators?|festival@|info@|hello@|contact@)/i;

function extractEmails(html, website) {
  if (!html) return { bookingEmail: null, contactEmail: null };

  // Decode HTML entities before scanning
  const decoded = html
    .replace(/&#64;/g, "@").replace(/&#46;/g, ".").replace(/\[at\]/gi, "@")
    .replace(/\[dot\]/gi, ".").replace(/\s+at\s+/gi, "@").replace(/\s+dot\s+/gi, ".");

  // Strip script/style to avoid JS strings
  const stripped = decoded.replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  const rawEmails = [...new Set([...(stripped.matchAll(EMAIL_RE))].map(m => m[1].toLowerCase()))];
  const emails = rawEmails.filter(e => !EMAIL_BLACKLIST.test(e) && !DOMAIN_BLACKLIST.test(e));

  if (!emails.length) return { bookingEmail: null, contactEmail: null };

  // Prefer booking/programming emails
  const bookingEmail = emails.find(e => BOOKING_SIGNAL.test(e.split("@")[0])) ?? null;
  // Fallback: any email that isn't the website's own tech contact
  const websiteHost = (() => { try { return new URL(website).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  const siteEmail = emails.find(e => e.endsWith("@" + websiteHost) || e.endsWith("." + websiteHost)) ?? emails[0] ?? null;

  return {
    bookingEmail: bookingEmail ?? null,
    contactEmail: siteEmail ?? null,
  };
}

// ── Contact form detection ────────────────────────────────────────────────────

const CONTACT_FORM_RE = /\/contact(-us)?|\/get-in-touch|\/reach-us|\/kontakt|\/contato|\/contacto|\/nous-contacter|\/nous-joindre/i;
const CONTACT_TEXT_RE = /\bcontact\s*us\b|\bget\s*in\s*touch\b|\bsend\s*us\b|\breach\s*us\b/i;

function extractContactFormUrl(html, baseUrl) {
  if (!html || !baseUrl) return null;
  const re = /<a\s[^>]*href=["']([^"'#][^"']*?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const [, href, rawText] = m;
    const text = rawText.replace(/<[^>]+>/g, "").trim();
    if (!CONTACT_FORM_RE.test(href) && !CONTACT_TEXT_RE.test(text)) continue;
    try {
      const abs = new URL(href, baseUrl).href;
      const absHost = new URL(abs).hostname;
      const baseHost = new URL(baseUrl).hostname;
      if (absHost !== baseHost) continue; // same domain only
      return abs;
    } catch {}
  }
  return null;
}

// ── Instagram extraction ──────────────────────────────────────────────────────

const INSTAGRAM_RE = /instagram\.com\/([a-zA-Z0-9_.]+)\/?/i;

function extractInstagramHandle(html) {
  if (!html) return null;
  const m = html.match(INSTAGRAM_RE);
  if (!m) return null;
  const handle = m[1];
  // Skip generic/utility handles
  if (/^(p|share|explore|reel|stories|accounts|tv)$/i.test(handle)) return null;
  return handle;
}

// ── Per-festival extraction ───────────────────────────────────────────────────

async function extract(festival) {
  const website = festival.website?.startsWith("http")
    ? festival.website
    : `https://${festival.website}`;

  const { html, finalUrl } = await fetchPage(website, { retries: 1, timeoutMs: 10_000 });
  if (!html) return null;

  const effectiveBase = finalUrl || website;

  const { bookingEmail, contactEmail } = extractEmails(html, website);
  const contactFormUrl = extractContactFormUrl(html, effectiveBase);
  const instagramHandle = extractInstagramHandle(html);

  // Require at least one contact path
  const bestEmail = bookingEmail ?? contactEmail;
  if (!bestEmail && !contactFormUrl && !instagramHandle) return null;

  return {
    application_email:   bestEmail,
    contact_form_url:    contactFormUrl,
    instagram_handle:    instagramHandle,
    booking_email:       bookingEmail,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(68)}`);
console.log(`  Pass D — Contact Extraction → contact_submission`);
console.log(`  ${new Date().toISOString()}${DRY_RUN ? "  [DRY RUN]" : ""}`);
console.log(`${"═".repeat(68)}\n`);

let query = db.from("festivals")
  .select("id, festival_name, country, city, website")
  .eq("application_status", "unknown")
  .eq("is_archived", false)
  .not("website", "is", null)
  .order("id");

if (idArg)    query = db.from("festivals").select("id, festival_name, country, city, website").eq("id", idArg);
if (limitArg && !idArg) query = query.limit(limitArg);

const { data: festivals, error } = await query;
if (error)              { console.error("[FATAL]", error.message); process.exit(1); }
if (!festivals?.length) { console.log("  No targets remaining.\n"); process.exit(0); }

console.log(`  Targets: ${festivals.length} unknown festivals\n`);

let found = 0, byEmail = 0, byForm = 0, byInstagram = 0, skipped = 0, dbErrors = 0;

for (let i = 0; i < festivals.length; i += CONCURRENCY) {
  const batch = festivals.slice(i, i + CONCURRENCY);

  await Promise.all(batch.map(async festival => {
    const label = `[${String(festival.id).padStart(4)}] ${festival.festival_name.slice(0, 44).padEnd(44)}`;
    process.stdout.write(`  … ${label} checking\r`);

    let result;
    try { result = await extract(festival); }
    catch (err) {
      console.log(`  ✗ ${label} ERROR: ${err.message.slice(0, 60)}`);
      return;
    }

    if (!result) { skipped++; return; }

    found++;
    const contactType =
      result.booking_email  ? "booking email" :
      result.application_email ? "contact email" :
      result.contact_form_url  ? "contact form" : "instagram";

    if (result.booking_email || result.application_email) byEmail++;
    if (result.contact_form_url) byForm++;
    if (result.instagram_handle && !result.application_email && !result.contact_form_url) byInstagram++;

    console.log(`  ✓ ${label} [${contactType.padEnd(14)}] ${(result.application_email ?? result.contact_form_url ?? `@${result.instagram_handle}` ?? "").slice(0, 45)}`);

    if (DRY_RUN) return;

    const updateData = {
      application_status: "contact_submission",
    };
    if (result.application_email) updateData.application_email = result.application_email;
    if (result.contact_form_url)  updateData.contact_form_url  = result.contact_form_url;

    const { error: dbErr } = await db.from("festivals").update(updateData).eq("id", festival.id);
    if (dbErr) { console.warn(`    [warn] DB write failed: ${dbErr.message}`); dbErrors++; found--; }
  }));

  if (i + CONCURRENCY < festivals.length) await sleep(DELAY_MS);
}

console.log(`\n${"═".repeat(68)}`);
console.log(`  PASS D RESULTS`);
console.log(`${"═".repeat(68)}`);
console.log(`  Processed:         ${festivals.length}`);
console.log(`  contact_submission: ${found}`);
console.log(`    → Email found:   ${byEmail}`);
console.log(`    → Form found:    ${byForm}`);
console.log(`    → Instagram only:${byInstagram}`);
console.log(`  Skipped (no path): ${skipped}`);
console.log(`  DB errors:         ${dbErrors}`);
console.log(`  Conversion rate:   ${((found / festivals.length) * 100).toFixed(1)}%`);
if (!DRY_RUN) {
  const [applyRes, contactRes, unknRes] = await Promise.all([
    db.from("festivals").select("id", { count: "exact", head: true })
      .in("application_status", ["verified_application","filmfreeway","festhome","email_submission","contact_form"])
      .eq("is_archived", false),
    db.from("festivals").select("id", { count: "exact", head: true })
      .eq("application_status", "contact_submission").eq("is_archived", false),
    db.from("festivals").select("id", { count: "exact", head: true })
      .eq("application_status", "unknown").eq("is_archived", false),
  ]);
  console.log(`\n  Apply Now:          ${applyRes.count}`);
  console.log(`  Contact Submission: ${contactRes.count}`);
  console.log(`  Unknown:            ${unknRes.count}`);
}
console.log(`${"═".repeat(68)}\n`);
