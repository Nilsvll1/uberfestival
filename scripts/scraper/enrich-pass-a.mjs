/**
 * Pass A — Enhanced BFS website crawl
 *
 * Improvements over B2+B3 deepCrawl:
 *   1. BFS depth 2: follows ALL nav/menu/footer links from homepage,
 *      then checks each sub-page for application content and platform links
 *   2. Expanded URL path guessing: 35+ paths (/participate, /performers, etc.)
 *   3. Submittable subdomain guessing: {slug}.submittable.com
 *   4. More platform patterns (Zealous, Eventival subdomains)
 *   5. Updates application_status alongside booking_model
 *
 * Usage:
 *   node --env-file=.env enrich-pass-a.mjs
 *   node --env-file=.env enrich-pass-a.mjs --dry-run
 *   node --env-file=.env enrich-pass-a.mjs --limit=50
 *   node --env-file=.env enrich-pass-a.mjs --id=42
 */

import { db }        from "./lib/supabase.mjs";
import { fetchPage } from "./lib/fetch-page.mjs";

const args     = process.argv.slice(2);
const DRY_RUN  = args.includes("--dry-run");
const limitArg = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "0", 10);
const idArg    = parseInt(args.find(a => a.startsWith("--id="))?.split("=")[1]    ?? "0", 10);

const CONCURRENCY = 3;
const DELAY_MS    = 1_200;
const sleep       = ms => new Promise(r => setTimeout(r, ms));

// ── Platform detection ────────────────────────────────────────────────────────

const PLATFORM_RE = /filmfreeway\.com|festhome\.com|submittable\.com|jotform\.com|typeform\.com|docs\.google\.com\/forms|eventival\.(?:com|eu)|wufoo\.com|formstack\.com|airtable\.com\/shr|zealous\.co\/calls|cognitoforms\.com|surveymonkey\.com\/r\/|paperform\.co/i;

function detectPlatform(url) {
  const map = [
    [/filmfreeway\.com/,            "filmfreeway"],
    [/festhome\.com/,               "festhome"],
    [/submittable\.com/,            "submittable"],
    [/jotform\.com/,                "jotform"],
    [/typeform\.com/,               "typeform"],
    [/docs\.google\.com\/forms/,    "google_forms"],
    [/eventival\.(?:com|eu)/,       "eventival"],
    [/wufoo\.com/,                  "wufoo"],
    [/formstack\.com/,              "formstack"],
    [/airtable\.com/,               "airtable"],
    [/zealous\.co/,                 "zealous"],
    [/cognitoforms\.com/,           "cognito_forms"],
    [/surveymonkey\.com/,           "surveymonkey"],
    [/paperform\.co/,               "paperform"],
  ];
  for (const [re, name] of map) if (re.test(url)) return name;
  return "official";
}

function platformToStatus(platform) {
  if (platform === "filmfreeway") return "filmfreeway";
  if (platform === "festhome")    return "festhome";
  const formPlatforms = [
    "submittable", "jotform", "typeform", "google_forms",
    "wufoo", "formstack", "airtable", "eventival", "zealous",
    "cognito_forms", "surveymonkey", "paperform",
  ];
  if (formPlatforms.includes(platform)) return "contact_form";
  return "verified_application";
}

// ── Slug generation ───────────────────────────────────────────────────────────

function slugs(name) {
  const base = name.toLowerCase()
    .replace(/[''`]/g, "").replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return [...new Set([
    base,
    base.replace(/-festival$/, ""),
    base.replace(/-music-festival$/, ""),
    base.replace(/-jazz-festival$/, ""),
    base.replace(/-film-festival$/, ""),
    base.replace(/-open-air$/, ""),
    base.replace(/-international$/, ""),
    base.replace(/^the-/, ""),
    base.replace(/-/g, ""),
  ])].filter(Boolean);
}

// ── Apply content detection ───────────────────────────────────────────────────

// STRONG: multi-word phrases that specifically signal artist/band applications
const STRONG_KEYWORDS = [
  /call.for.artists?/i, /open.call/i, /call.for.entr/i,
  /artist\s+application/i, /band\s+application/i, /performer\s+application/i,
  /band\s+registration/i, /performer\s+registration/i, /artist\s+registration/i,
  /music\s+submission/i, /how\s+to\s+(?:apply|submit|perform)/i,
  /want\s+to\s+perform/i, /want\s+to\s+play/i,
  /apply\s+to\s+perform/i, /apply\s+to\s+play/i,
  /submit\s+your\s+(?:act|music|band|demo|application)/i,
  /\bfor\s+artists\b/i, /\bfor\s+musicians\b/i, /\bfor\s+performers\b/i,
  /\bentry\s+form\b/i, /\baudition\b/i,
];

// WEAK: generic words that need multiple hits + a form to be meaningful
const WEAK_KEYWORDS = [
  /\bapply\b/i, /\bapplication\b/i, /\bsubmit\b/i, /\bsubmission\b/i,
  /\bperform\b/i, /\bshowcase\b/i, /\bregistration\b/i,
];

// Pages that are definitely not artist applications
const BAD_PAGE_RE = /\/ticket(s|ing|-office)?|\/buy(-tickets)?|\/shop(\/|$)|\/store(\/|$)|\/media(\/|$)|\/press(\/|$)|\/news\/|\/(2\d{3})\/|\/login|\/signin|\/sign-in|\/connexion|\/billetterie|\/membership|\/trader(s)?(\/|$)|\/vendor(s)?(\/|$)|\/contact(-us)?(\/|$)|\/contact\.html/i;

function isHomepage(url) {
  try {
    const { pathname } = new URL(url);
    return pathname === "/" || pathname === "" || pathname === "/index.html" || pathname === "/en/" || pathname === "/fr/";
  } catch { return false; }
}

function scoreApplyPage(url, html) {
  if (BAD_PAGE_RE.test(url)) return null;
  if (isHomepage(url)) return null; // homepages always have too many false signals

  const platform = detectPlatform(url);
  if (platform !== "official") return { url, platform, confidence: 0.88 };

  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 14_000);
  const strongHits = STRONG_KEYWORDS.filter(p => p.test(text)).length;
  const weakHits   = WEAK_KEYWORDS.filter(p => p.test(text)).length;
  const hasForm    = /<form\b/i.test(html);

  // Require strong signal: 1+ strong keyword OR (form + 3 weak keywords)
  if (strongHits >= 1 && hasForm)   return { url, platform, confidence: 0.82 };
  if (strongHits >= 2)              return { url, platform, confidence: 0.78 };
  if (strongHits >= 1 && weakHits >= 2) return { url, platform, confidence: 0.74 };
  if (hasForm && weakHits >= 3)     return { url, platform, confidence: 0.72 };
  return null;
}

// ── Link scoring for BFS traversal ───────────────────────────────────────────

const APPLY_URL_RE = /\/apply|\/applications?|\/submit|\/submissions?|\/call-for-|\/open-call|\/entries|\/audition|\/for-artists|\/for-bands|\/perform|\/participate|\/registration|\/showcase|\/musicians|\/performers|\/bands|\/take-part|\/get-involved|\/join|\/showcase-submission|\/programme/i;
const APPLY_TEXT_RE = /\bapply\b|\bapplication\b|\bsubmit\b|\bopen.call\b|\bcall.for\b|\baudition\b|\bperform\b|\bparticipate\b|\bregistration\b|\bshowcase\b|\bget.involved\b|\bfor.artists\b|\bjoin.us\b|\btake.part\b/i;

function scoreLinkForApply(href, text) {
  let s = 0;
  if (APPLY_URL_RE.test(href))   s += 20;
  if (APPLY_TEXT_RE.test(text))  s += 15;
  if (PLATFORM_RE.test(href))    s += 40;
  return s;
}

// Extract all same-domain links + cross-domain platform links
function extractLinks(html, baseUrl, festivalHost, { minScore = 0, max = 30 } = {}) {
  const seen = new Set();
  const links = [];
  const re = /<a\s[^>]*href=["']([^"'#][^"']*?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const [, href, rawText] = m;
    const text = rawText.replace(/<[^>]+>/g, "").trim();
    if (!href || /^(mailto:|tel:|javascript:)/i.test(href)) continue;
    try {
      const abs = new URL(href, baseUrl).href;
      if (seen.has(abs)) continue;
      seen.add(abs);
      const rHost = new URL(abs).hostname.replace(/^www\./, "");
      const isSameDomain = rHost === festivalHost || rHost.endsWith("." + festivalHost);
      const isPlatform   = PLATFORM_RE.test(abs);
      if (!isSameDomain && !isPlatform) continue;
      if (BAD_PAGE_RE.test(abs)) continue;
      const score = scoreLinkForApply(href, text);
      if (score >= minScore || isPlatform) links.push({ url: abs, score, isPlatform, text });
    } catch {}
  }
  return links.sort((a, b) => b.score - a.score)
    .filter((l, _, arr) => arr.indexOf(l) < max);
}

// ── Expanded URL path guessing ────────────────────────────────────────────────

const GUESS_PATHS = [
  // Core application paths
  "/apply", "/applications", "/submission", "/submissions",
  "/open-call", "/call-for-entries", "/call-for-artists",
  "/for-artists", "/for-musicians", "/for-performers",
  "/artists/apply", "/artists/registration", "/artists/submission",
  "/submit", "/entries",
  // Participation paths
  "/participate", "/take-part", "/get-involved", "/join-us",
  "/perform", "/play",
  // Registration paths
  "/register", "/registration", "/artist-registration",
  "/band-registration", "/performer-registration",
  // Showcase / programme
  "/showcase", "/showcase-submission", "/showcase-application",
  "/programme/apply", "/programme/submissions", "/programme/artists",
  // Audition / booking
  "/auditions", "/audition", "/booking",
  // French language paths (common for European festivals)
  "/candidature", "/soumettre", "/participer",
  // Spanish
  "/inscripcion", "/convocatoria",
];

async function guessUrlPaths(festival, baseUrl) {
  const origin = (() => { try { return new URL(baseUrl).origin; } catch { return null; } })();
  if (!origin) return null;
  const festivalHost = new URL(baseUrl).hostname.replace(/^www\./, "");

  const results = await Promise.all(
    GUESS_PATHS.map(async path => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4_000);
        const res = await fetch(origin + path, {
          method: "HEAD",
          redirect: "follow",
          signal: ctrl.signal,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; UberFestivalBot/1.0)" },
        }).finally(() => clearTimeout(t));
        if (!res.ok) return null;
        return res.url || origin + path;
      } catch { return null; }
    })
  );

  for (const url of results.filter(Boolean)) {
    if (BAD_PAGE_RE.test(url)) continue;
    const rHost = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; } })();
    const isSameDomain = rHost === festivalHost || rHost?.endsWith("." + festivalHost);
    if (!isSameDomain && detectPlatform(url) === "official") continue;
    const { html } = await fetchPage(url, { retries: 0, timeoutMs: 8_000 });
    if (!html) continue;
    const scored = scoreApplyPage(url, html);
    if (scored) return { ...scored, source: `pass_a_guess:${url}` };
  }
  return null;
}

// ── Submittable subdomain check ───────────────────────────────────────────────

async function checkSubmittable(festival) {
  for (const s of slugs(festival.festival_name).slice(0, 4)) {
    const url = `https://${s}.submittable.com`;
    try {
      const { html, finalUrl } = await fetchPage(url, { retries: 0, timeoutMs: 6_000 });
      if (!html) continue;
      if (!finalUrl?.includes("submittable.com")) continue;
      // Submittable redirects to the generic page if the subdomain doesn't exist
      if (finalUrl.includes("submittable.com/p/") || finalUrl === "https://submittable.com/") continue;
      return { url: finalUrl || url, platform: "submittable", confidence: 0.85, source: "submittable_subdomain" };
    } catch { continue; }
  }
  return null;
}

// ── BFS crawl ─────────────────────────────────────────────────────────────────

async function bfsCrawl(festival, baseUrl) {
  const festivalHost = (() => { try { return new URL(baseUrl).hostname.replace(/^www\./, ""); } catch { return null; } })();
  if (!festivalHost) return null;

  const { html: homeHtml, finalUrl } = await fetchPage(baseUrl, { retries: 1, timeoutMs: 10_000 });
  if (!homeHtml) return null;

  const effectiveBase = finalUrl || baseUrl;

  // Level 0: direct platform links on homepage (immediate win)
  const homeLinks = extractLinks(homeHtml, effectiveBase, festivalHost, { minScore: 0, max: 40 });
  for (const l of homeLinks.filter(l => l.isPlatform)) {
    return { url: l.url, platform: detectPlatform(l.url), confidence: 0.85, source: "home_platform_a" };
  }

  // Level 0: high-score apply links on homepage
  for (const l of homeLinks.filter(l => l.score >= 20)) {
    const { html } = await fetchPage(l.url, { retries: 0, timeoutMs: 8_000 });
    if (!html) continue;
    const scored = scoreApplyPage(l.url, html);
    if (scored) return { ...scored, source: `pass_a_home:${l.url}` };
    // Also look for platform links on this sub-page
    const subLinks = extractLinks(html, l.url, festivalHost, { minScore: 0, max: 20 });
    for (const sl of subLinks.filter(sl => sl.isPlatform)) {
      return { url: sl.url, platform: detectPlatform(sl.url), confidence: 0.82, source: "sub_platform_a" };
    }
  }

  // Level 1: follow ALL nav-section links from homepage (BFS depth 2)
  const navLinks = homeLinks.filter(l => l.score < 20 && !l.isPlatform).slice(0, 15);
  for (const l of navLinks) {
    const { html: subHtml } = await fetchPage(l.url, { retries: 0, timeoutMs: 7_000 });
    if (!subHtml) continue;

    // Check this sub-page for apply content
    const scored = scoreApplyPage(l.url, subHtml);
    if (scored?.confidence >= 0.72) return { ...scored, source: `pass_a_bfs:${l.url}` };

    // Look for platform/apply links on this sub-page
    const subLinks = extractLinks(subHtml, l.url, festivalHost, { minScore: 15, max: 10 });
    for (const sl of subLinks) {
      if (sl.isPlatform) {
        return { url: sl.url, platform: detectPlatform(sl.url), confidence: 0.82, source: "bfs_platform_a" };
      }
      const { html: deepHtml } = await fetchPage(sl.url, { retries: 0, timeoutMs: 6_000 });
      if (!deepHtml) continue;
      const deepScored = scoreApplyPage(sl.url, deepHtml);
      if (deepScored?.confidence >= 0.72) return { ...deepScored, source: `pass_a_bfs2:${sl.url}` };
    }
  }

  return null;
}

// ── Per-festival logic ────────────────────────────────────────────────────────

async function enrich(festival) {
  const baseUrl = festival.website?.startsWith("http")
    ? festival.website
    : festival.website ? `https://${festival.website}` : null;

  // 1. BFS crawl
  if (baseUrl) {
    const crawl = await bfsCrawl(festival, baseUrl);
    if (crawl) return crawl;
  }

  // 2. Expanded URL path guessing
  if (baseUrl) {
    const guess = await guessUrlPaths(festival, baseUrl);
    if (guess) return guess;
  }

  // 3. Submittable subdomain
  const sub = await checkSubmittable(festival);
  if (sub) return sub;

  return null;
}

// ── DB write ──────────────────────────────────────────────────────────────────

async function saveResult(festival, result) {
  const appStatus = platformToStatus(result.platform);
  const { error } = await db.from("festivals").update({
    application_url:         result.url,
    application_platform:    result.platform,
    application_source:      result.source,
    application_confidence:  result.confidence,
    application_verified_at: new Date().toISOString(),
    booking_model:           "open_call",
    application_status:      appStatus,
    link_check_status:       "unchecked",
  }).eq("id", festival.id);
  return error;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(68)}`);
console.log(`  Pass A — Enhanced BFS Crawl + Submittable`);
console.log(`  ${new Date().toISOString()}${DRY_RUN ? "  [DRY RUN]" : ""}`);
console.log(`${"═".repeat(68)}\n`);

let query = db.from("festivals")
  .select("id, festival_name, category, country, website")
  .eq("application_status", "unknown")
  .eq("is_archived", false)
  .not("website", "is", null)
  .order("id");

if (idArg)    query = db.from("festivals").select("id, festival_name, category, country, website").eq("id", idArg);
if (limitArg && !idArg) query = query.limit(limitArg);

const { data: festivals, error } = await query;
if (error)             { console.error("[FATAL]", error.message); process.exit(1); }
if (!festivals?.length) { console.log("  No targets remaining.\n"); process.exit(0); }

console.log(`  Targets: ${festivals.length} unknown festivals\n`);

let found = 0, skipped = 0, dbErrors = 0;
const byPlatform = {}, bySource = {};

for (let i = 0; i < festivals.length; i += CONCURRENCY) {
  const batch = festivals.slice(i, i + CONCURRENCY);

  await Promise.all(batch.map(async festival => {
    const label = `[${String(festival.id).padStart(4)}] ${festival.festival_name.slice(0, 44).padEnd(44)}`;
    process.stdout.write(`  … ${label} checking\r`);

    let result;
    try { result = await enrich(festival); }
    catch (err) {
      console.log(`  ✗ ${label} ERROR: ${err.message.slice(0, 60)}`);
      return;
    }

    if (!result) { skipped++; return; }

    found++;
    byPlatform[result.platform] = (byPlatform[result.platform] ?? 0) + 1;
    const src = result.source?.split(":")[0] ?? "unknown";
    bySource[src] = (bySource[src] ?? 0) + 1;
    console.log(`  ✓ ${label} [${result.platform.padEnd(14)}] conf=${result.confidence.toFixed(2)}  ${result.url.slice(0, 55)}`);

    if (DRY_RUN) return;

    const dbErr = await saveResult(festival, result);
    if (dbErr) { console.warn(`    [warn] DB write failed: ${dbErr.message}`); dbErrors++; found--; }
  }));

  if (i + CONCURRENCY < festivals.length) await sleep(DELAY_MS);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(68)}`);
console.log(`  PASS A RESULTS`);
console.log(`${"═".repeat(68)}`);
console.log(`  Processed: ${festivals.length}  |  Found: ${found}  |  Skipped: ${skipped}  |  Errors: ${dbErrors}`);
console.log(`  Hit rate:  ${((found / festivals.length) * 100).toFixed(1)}%`);
if (Object.keys(byPlatform).length) {
  console.log(`\n  By platform:`);
  Object.entries(byPlatform).sort((a, b) => b[1] - a[1]).forEach(([p, n]) => console.log(`    ${p.padEnd(18)} ${n}`));
}
if (Object.keys(bySource).length) {
  console.log(`\n  By source:`);
  Object.entries(bySource).sort((a, b) => b[1] - a[1]).forEach(([s, n]) => console.log(`    ${s.padEnd(24)} ${n}`));
}
if (!DRY_RUN) {
  const applyRes = await db.from("festivals").select("id", { count: "exact", head: true })
    .in("application_status", ["verified_application","filmfreeway","festhome","email_submission","contact_form"])
    .eq("is_archived", false);
  const unknRes  = await db.from("festivals").select("id", { count: "exact", head: true })
    .eq("application_status", "unknown").eq("is_archived", false);
  console.log(`\n  Apply Now:  ${applyRes.count}  |  Unknown: ${unknRes.count}`);
}
console.log(`${"═".repeat(68)}\n`);
