/**
 * Pass D2 — Aggressive contact extraction
 *
 * Improvements over Pass D:
 *   1. Follows the contact page link to extract emails from there
 *      (many festivals only show email on /contact, not homepage)
 *   2. Also tries /about, /team, /staff, /notre-equipe, /equipo, /chi-siamo pages
 *   3. Extracts mailto: links directly (more reliable than regex scanning)
 *   4. Multilingual contact page path guessing
 *   5. Handles mailto: obfuscation with JS data-email attributes
 *   6. Can also run on already-found contact_submission to improve data quality
 *
 * Usage:
 *   node --env-file=.env enrich-pass-d2.mjs
 *   node --env-file=.env enrich-pass-d2.mjs --dry-run
 *   node --env-file=.env enrich-pass-d2.mjs --limit=200
 *   node --env-file=.env enrich-pass-d2.mjs --also-contact   (re-process contact_submission too)
 */

import { db }        from "./lib/supabase.mjs";
import { fetchPage } from "./lib/fetch-page.mjs";

const args        = process.argv.slice(2);
const DRY_RUN     = args.includes("--dry-run");
const ALSO_CONTACT = args.includes("--also-contact");
const limitArg    = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "0", 10);
const idArg       = parseInt(args.find(a => a.startsWith("--id="))?.split("=")[1]    ?? "0", 10);

const CONCURRENCY = 5;
const DELAY_MS    = 600;
const sleep       = ms => new Promise(r => setTimeout(r, ms));

// ── Email extraction ──────────────────────────────────────────────────────────

const EMAIL_RE = /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g;

const EMAIL_BLACKLIST = /ticket|sales|box-?office|webmaster|noreply|no-reply|info@info|admin@|support@|accounts@|billing@|press@media|marketing@|newsletter@|unsubscribe@|spam@|abuse@|postmaster@|tech@|it@|web@|online@|digital@/i;

const DOMAIN_BLACKLIST = /\.(domains?|seo|example|test|placeholder|sample|demo|spam|temp)\.|@(example|test|placeholder|domain|youremail|yourname|email)\.|sposti\.fi$|@esimerkki\.|@example\./i;

const BOOKING_SIGNAL = /^(booking|programme|programming|lineup|artists?|bands?|performers?|music|talent|acts|submissions?|entries|apply|applications?|curators?|festival@|info@|hello@|contact@|hola@|bonjour@|ciao@|hallo@)/i;

// Extract emails from HTML, also checks data-email attributes and mailto: links
function extractEmails(html, website) {
  if (!html) return { bookingEmail: null, contactEmail: null };

  // Method 1: data-email attributes (anti-spam obfuscation)
  const dataEmailRe = /data-email=["']([^"']+)["']/gi;
  const dataEmails = [];
  let dm;
  while ((dm = dataEmailRe.exec(html)) !== null) dataEmails.push(dm[1].toLowerCase());

  // Method 2: mailto: links (most reliable)
  const mailtoRe = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
  const mailtoEmails = [];
  let mm;
  while ((mm = mailtoRe.exec(html)) !== null) mailtoEmails.push(mm[1].toLowerCase());

  // Method 3: plain email regex after decoding obfuscations
  const decoded = html
    .replace(/&#64;/g, "@").replace(/&#46;/g, ".")
    .replace(/\[at\]/gi, "@").replace(/\[dot\]/gi, ".")
    .replace(/\s+at\s+/gi, "@").replace(/\s+dot\s+/gi, ".")
    .replace(/\(at\)/gi, "@").replace(/\(dot\)/gi, ".");

  const stripped = decoded
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  const rawEmails = [...new Set([...(stripped.matchAll(EMAIL_RE))].map(m => m[1].toLowerCase()))];

  // Combine all sources, prioritize: mailto > data-email > regex
  const all = [...new Set([...mailtoEmails, ...dataEmails, ...rawEmails])]
    .filter(e => !EMAIL_BLACKLIST.test(e) && !DOMAIN_BLACKLIST.test(e));

  if (!all.length) return { bookingEmail: null, contactEmail: null };

  const bookingEmail = all.find(e => BOOKING_SIGNAL.test(e.split("@")[0])) ?? null;
  const websiteHost = (() => { try { return new URL(website).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  const siteEmail = all.find(e => e.endsWith("@" + websiteHost) || e.endsWith("." + websiteHost)) ?? all[0] ?? null;

  return { bookingEmail, contactEmail: siteEmail };
}

// ── Contact page detection ────────────────────────────────────────────────────

const CONTACT_PAGE_PATHS = [
  "/contact", "/contact-us", "/contacts", "/contact-us.html",
  "/get-in-touch", "/reach-us", "/reach-out",
  // French
  "/contact", "/nous-contacter", "/nous-joindre", "/contactez-nous",
  // German
  "/kontakt", "/kontaktformular",
  // Spanish
  "/contacto", "/contactanos", "/contactenos",
  // Portuguese
  "/contato", "/contate-nos",
  // Italian
  "/contatti", "/contattaci",
  // Dutch
  "/contact", "/contactformulier",
  // Nordic
  "/kontakt", "/kontakta-oss", "/kontakt-oss",
  // Staff/team pages often have contact info
  "/team", "/staff", "/about-us", "/about",
  "/equipe", "/notre-equipe",    // French
  "/team", "/ueber-uns",          // German
  "/equipo",                      // Spanish
  "/chi-siamo",                   // Italian
];

const CONTACT_FORM_RE = /\/contact(-us)?|\/get-in-touch|\/reach-us|\/kontakt|\/contato|\/contacto|\/contatti|\/nous-contacter|\/nous-joindre|\/contactez-nous|\/contactenos|\/contate-nos|\/contactformulier|\/kontakta-oss|\/kontakt-oss/i;
const CONTACT_TEXT_RE = /\bcontact\s*us\b|\bget\s*in\s*touch\b|\bsend\s*us\b|\breach\s*us\b|\bnous\s+contacter\b|\bkontaktieren\b|\bcontáctanos\b|\bcontate-nos\b|\bcontattaci\b/i;

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
      if (new URL(abs).hostname !== new URL(baseUrl).hostname) continue;
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
  if (/^(p|share|explore|reel|stories|accounts|tv)$/i.test(handle)) return null;
  return handle;
}

// ── Per-festival extraction ───────────────────────────────────────────────────

async function extract(festival) {
  const website = festival.website?.startsWith("http")
    ? festival.website
    : `https://${festival.website}`;

  // Fetch homepage
  const { html: homeHtml, finalUrl } = await fetchPage(website, { retries: 1, timeoutMs: 10_000 });
  if (!homeHtml) return null;

  const effectiveBase = finalUrl || website;
  const festivalHost  = (() => { try { return new URL(effectiveBase).hostname; } catch { return null; } })();

  // Extract from homepage
  let { bookingEmail, contactEmail } = extractEmails(homeHtml, website);
  let contactFormUrl = extractContactFormUrl(homeHtml, effectiveBase);
  let instagramHandle = extractInstagramHandle(homeHtml);

  // If no booking email found, try fetching the contact page
  if (!bookingEmail && !contactFormUrl) {
    // First: follow any contact link from homepage
    const contactPageUrl = contactFormUrl ?? (() => {
      const re = /<a\s[^>]*href=["']([^"'#][^"']*?)["'][^>]*>/gi;
      let m;
      while ((m = re.exec(homeHtml)) !== null) {
        try {
          const abs = new URL(m[1], effectiveBase).href;
          const absHost = new URL(abs).hostname;
          if (absHost !== festivalHost) continue;
          if (CONTACT_FORM_RE.test(abs)) return abs;
        } catch {}
      }
      return null;
    })();

    if (contactPageUrl) {
      const { html: contactHtml } = await fetchPage(contactPageUrl, { retries: 0, timeoutMs: 7_000 });
      if (contactHtml) {
        const { bookingEmail: be2, contactEmail: ce2 } = extractEmails(contactHtml, website);
        if (be2) bookingEmail = be2;
        if (!contactEmail && ce2) contactEmail = ce2;
        if (!contactFormUrl) contactFormUrl = contactPageUrl;
      }
    }
  }

  // If still no email, try guessing contact page paths
  if (!bookingEmail && !contactEmail) {
    const origin = (() => { try { return new URL(effectiveBase).origin; } catch { return null; } })();
    if (origin) {
      for (const path of CONTACT_PAGE_PATHS) {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 3_000);
          const res = await fetch(origin + path, {
            method: "HEAD", redirect: "follow", signal: ctrl.signal,
            headers: { "User-Agent": "Mozilla/5.0 (compatible; UberFestivalBot/1.0)" },
          }).finally(() => clearTimeout(t));
          if (!res.ok) continue;
          const pHost = (() => { try { return new URL(res.url).hostname; } catch { return ""; } })();
          if (pHost !== festivalHost) continue;

          const { html: pathHtml } = await fetchPage(res.url, { retries: 0, timeoutMs: 6_000 });
          if (!pathHtml) continue;
          const { bookingEmail: be3, contactEmail: ce3 } = extractEmails(pathHtml, website);
          if (be3) { bookingEmail = be3; contactFormUrl = contactFormUrl ?? res.url; break; }
          if (ce3) { contactEmail = ce3; contactFormUrl = contactFormUrl ?? res.url; break; }
        } catch { continue; }
      }
    }
  }

  const bestEmail = bookingEmail ?? contactEmail;
  if (!bestEmail && !contactFormUrl && !instagramHandle) return null;

  return {
    application_email:  bestEmail,
    contact_form_url:   contactFormUrl,
    instagram_handle:   instagramHandle,
    booking_email:      bookingEmail,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(68)}`);
console.log(`  Pass D2 — Aggressive Contact Extraction`);
console.log(`  ${new Date().toISOString()}${DRY_RUN ? "  [DRY RUN]" : ""}`);
console.log(`${"═".repeat(68)}\n`);

const targetStatuses = ALSO_CONTACT
  ? ["unknown", "contact_submission"]
  : ["unknown"];

let query = db.from("festivals")
  .select("id, festival_name, country, city, website")
  .in("application_status", targetStatuses)
  .eq("is_archived", false)
  .not("website", "is", null)
  .order("id");

if (idArg)              query = db.from("festivals").select("id, festival_name, country, city, website").eq("id", idArg);
if (limitArg && !idArg) query = query.limit(limitArg);

const { data: festivals, error } = await query;
if (error)              { console.error("[FATAL]", error.message); process.exit(1); }
if (!festivals?.length) { console.log("  No targets remaining.\n"); process.exit(0); }

console.log(`  Targets: ${festivals.length} festivals (${targetStatuses.join(", ")})\n`);

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
      result.booking_email      ? "booking email" :
      result.application_email  ? "contact email" :
      result.contact_form_url   ? "contact form"  : "instagram";

    if (result.booking_email || result.application_email) byEmail++;
    if (result.contact_form_url)  byForm++;
    if (result.instagram_handle && !result.application_email && !result.contact_form_url) byInstagram++;

    console.log(`  ✓ ${label} [${contactType.padEnd(14)}] ${(result.application_email ?? result.contact_form_url ?? `@${result.instagram_handle}` ?? "").slice(0, 45)}`);

    if (DRY_RUN) return;

    const updateData = { application_status: "contact_submission" };
    if (result.application_email) updateData.application_email = result.application_email;
    if (result.contact_form_url)  updateData.contact_form_url  = result.contact_form_url;

    const { error: dbErr } = await db.from("festivals").update(updateData).eq("id", festival.id);
    if (dbErr) { console.warn(`    [warn] DB write failed: ${dbErr.message}`); dbErrors++; found--; }
  }));

  if (i + CONCURRENCY < festivals.length) await sleep(DELAY_MS);
}

console.log(`\n${"═".repeat(68)}`);
console.log(`  PASS D2 RESULTS`);
console.log(`${"═".repeat(68)}`);
console.log(`  Processed:          ${festivals.length}`);
console.log(`  contact_submission: ${found}`);
console.log(`    → Email found:    ${byEmail}`);
console.log(`    → Form found:     ${byForm}`);
console.log(`    → Instagram only: ${byInstagram}`);
console.log(`  Skipped (no path):  ${skipped}`);
console.log(`  DB errors:          ${dbErrors}`);
console.log(`  Conversion rate:    ${((found / festivals.length) * 100).toFixed(1)}%`);
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
