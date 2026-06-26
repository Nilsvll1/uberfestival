/**
 * Pass B — Web search via DuckDuckGo
 *
 * For each remaining unknown festival, runs 3 targeted searches:
 *   1. "{name}" filmfreeway OR festhome OR submittable
 *   2. "{name}" apply performers musicians 2025 2026
 *   3. "{name}" "open call" OR "call for entries" OR "artist application"
 *
 * Parses result URLs, checks each against known platforms and confirms
 * application pages using the same scoring logic as Pass A.
 *
 * Rate limiting: 3s base delay + jitter between requests. DuckDuckGo
 * tolerates this rate — if you hit CAPTCHA, wait 10 minutes and resume.
 *
 * Usage:
 *   node --env-file=.env enrich-pass-b.mjs
 *   node --env-file=.env enrich-pass-b.mjs --dry-run
 *   node --env-file=.env enrich-pass-b.mjs --limit=100
 *   node --env-file=.env enrich-pass-b.mjs --id=42
 */

import { db }        from "./lib/supabase.mjs";
import { fetchPage } from "./lib/fetch-page.mjs";

const args     = process.argv.slice(2);
const DRY_RUN  = args.includes("--dry-run");
const limitArg = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "0", 10);
const idArg    = parseInt(args.find(a => a.startsWith("--id="))?.split("=")[1]    ?? "0", 10);

// Pass B runs sequentially (not in parallel) to be polite to DDG
const SEARCH_DELAY_MS = 3_000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Platform detection (shared) ───────────────────────────────────────────────

const PLATFORM_RE = /filmfreeway\.com|festhome\.com|submittable\.com|jotform\.com|typeform\.com|docs\.google\.com\/forms|eventival\.(?:com|eu)|wufoo\.com|formstack\.com|airtable\.com|zealous\.co|cognitoforms\.com|surveymonkey\.com|paperform\.co/i;

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

// ── Apply page scoring ────────────────────────────────────────────────────────

const APPLY_KEYWORDS = [
  /apply\s*now/i, /\bapplication\b/i, /\bsubmit\b/i, /\bsubmission\b/i,
  /call.for.entr/i, /call.for.artists?/i, /open.call/i, /\baudition/i,
  /how\s+to\s+apply/i, /\bperform\s+at\b/i, /\bparticipate\b/i,
  /\bartist\s+application\b/i, /\bfor\s+artists\b/i, /\bfor\s+musicians\b/i,
];

const BAD_PAGE_RE = /\/ticket(s|ing|-office)?|\/buy(-tickets)?|\/shop(\/|$)|\/store(\/|$)|\/media(\/|$)|\/press(\/|$)|\/news\/|\/(2\d{3})\//i;

async function confirmApplyPage(url) {
  if (BAD_PAGE_RE.test(url)) return null;
  const platform = detectPlatform(url);
  if (platform !== "official") return { url, platform, confidence: 0.88 };

  const { html } = await fetchPage(url, { retries: 0, timeoutMs: 10_000 });
  if (!html) return null;
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 12_000);
  const hits = APPLY_KEYWORDS.filter(p => p.test(text)).length;
  const hasForm = /<form\b/i.test(html);

  if (hits === 0 && !hasForm) return null;
  if (hasForm && hits >= 2)   return { url, platform, confidence: 0.82 };
  if (hasForm || hits >= 2)   return { url, platform, confidence: 0.72 };
  return null;
}

// ── DuckDuckGo search ─────────────────────────────────────────────────────────

// URLs we should never include as results
const SKIP_DOMAINS = /facebook\.com|twitter\.com|instagram\.com|youtube\.com|wikipedia\.org|tiktok\.com|reddit\.com|tripadvisor\.|timeout\.com|theguardian\.|songkick\.com|bandsintown\.|ticketmaster\.|eventbrite\.|setlist\.fm|last\.fm|metacritic\.|allmusic\.com|discogs\.com|spotify\.com|soundcloud\.com|yelp\.|google\.|duckduckgo\.|bing\.com/i;

async function searchDDG(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=wt-wt`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15_000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
    }).finally(() => clearTimeout(t));

    if (!res.ok) return [];
    const html = await res.text();

    // Check for CAPTCHA/block
    if (html.includes("captcha") || html.includes("CAPTCHA") || html.length < 500) return [];

    // Parse result URLs — handle both direct links and DDG redirect format
    const urls = new Set();

    // Direct href links in result divs
    const re1 = /class="result__a"[^>]*href="(https?:\/\/[^"]+)"/g;
    let m;
    while ((m = re1.exec(html)) !== null) urls.add(m[1]);

    // DDG redirect format: uddg=URL
    const re2 = /uddg=(https?[^&"'\s]+)/g;
    while ((m = re2.exec(html)) !== null) {
      try { urls.add(decodeURIComponent(m[1])); } catch {}
    }

    // Fallback: any https link in result sections
    if (urls.size === 0) {
      const re3 = /<div class="result[^"]*">[\s\S]*?href="(https?:\/\/[^"]+)"/g;
      while ((m = re3.exec(html)) !== null) urls.add(m[1]);
    }

    return [...urls]
      .filter(u => !SKIP_DOMAINS.test(u))
      .slice(0, 8);
  } catch {
    return [];
  }
}

// ── Per-festival search ───────────────────────────────────────────────────────

async function searchFestival(festival) {
  const name = festival.festival_name.replace(/["""'']/g, "'").trim();

  const queries = [
    `"${name}" filmfreeway OR festhome OR submittable apply`,
    `"${name}" apply musicians performers 2025 2026`,
    `"${name}" "open call" OR "call for entries" OR "artist application" site submissions`,
  ];

  for (const q of queries) {
    await sleep(SEARCH_DELAY_MS + Math.random() * 1_500);
    const urls = await searchDDG(q);
    if (!urls.length) continue;

    for (const url of urls) {
      // Platform URLs: trust directly (high confidence)
      if (PLATFORM_RE.test(url)) {
        const platform = detectPlatform(url);
        // Verify it's not a generic/search page
        if (/filmfreeway\.com\/(search|festivals|categories|browse|discover|home)?(\?|\/?\s*$)/i.test(url)) continue;
        if (/festhome\.com\/festivals?\/?$/i.test(url)) continue;
        // Quick name-in-URL heuristic for platform pages
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
        const urlLower = url.toLowerCase().replace(/[^a-z0-9]+/g, "");
        if (!urlLower.includes(slug.slice(0, 6))) continue;
        return { url, platform, confidence: 0.85, source: `pass_b_search:${q.slice(0, 40)}` };
      }

      // Official pages: confirm with content check
      const confirmed = await confirmApplyPage(url);
      if (confirmed) return { ...confirmed, source: `pass_b_search:${q.slice(0, 40)}` };
    }
  }
  return null;
}

// ── DB write ──────────────────────────────────────────────────────────────────

async function saveResult(festival, result) {
  const { error } = await db.from("festivals").update({
    application_url:         result.url,
    application_platform:    result.platform,
    application_source:      result.source,
    application_confidence:  result.confidence,
    application_verified_at: new Date().toISOString(),
    booking_model:           "open_call",
    application_status:      platformToStatus(result.platform),
    link_check_status:       "unchecked",
  }).eq("id", festival.id);
  return error;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(68)}`);
console.log(`  Pass B — DuckDuckGo Web Search`);
console.log(`  ${new Date().toISOString()}${DRY_RUN ? "  [DRY RUN]" : ""}`);
console.log(`${"═".repeat(68)}\n`);
console.log(`  ⚠  This runs sequentially (3s+ delay/search) — expect 1–2 hours for all targets.`);
console.log(`  ⚠  Use --limit=200 for a partial run, then resume.\n`);

let query = db.from("festivals")
  .select("id, festival_name, category, country, website")
  .eq("application_status", "unknown")
  .eq("is_archived", false)
  .order("id");

if (idArg)    query = db.from("festivals").select("id, festival_name, category, country, website").eq("id", idArg);
if (limitArg && !idArg) query = query.limit(limitArg);

const { data: festivals, error } = await query;
if (error)              { console.error("[FATAL]", error.message); process.exit(1); }
if (!festivals?.length) { console.log("  No targets remaining.\n"); process.exit(0); }

console.log(`  Targets: ${festivals.length} unknown festivals\n`);

let found = 0, skipped = 0, dbErrors = 0, captchaCount = 0;
const byPlatform = {};

for (let i = 0; i < festivals.length; i++) {
  const festival = festivals[i];
  const label = `[${String(festival.id).padStart(4)}] ${festival.festival_name.slice(0, 44).padEnd(44)}`;
  process.stdout.write(`  … ${label} [${i + 1}/${festivals.length}]\r`);

  let result;
  try { result = await searchFestival(festival); }
  catch (err) {
    console.log(`  ✗ ${label} ERROR: ${err.message.slice(0, 60)}`);
    continue;
  }

  if (!result) { skipped++; continue; }

  found++;
  byPlatform[result.platform] = (byPlatform[result.platform] ?? 0) + 1;
  console.log(`  ✓ ${label} [${result.platform.padEnd(14)}] conf=${result.confidence.toFixed(2)}  ${result.url.slice(0, 50)}`);

  if (DRY_RUN) continue;

  const dbErr = await saveResult(festival, result);
  if (dbErr) { console.warn(`    [warn] DB write failed: ${dbErr.message}`); dbErrors++; found--; }
}

console.log(`\n${"═".repeat(68)}`);
console.log(`  PASS B RESULTS`);
console.log(`${"═".repeat(68)}`);
console.log(`  Processed: ${festivals.length}  |  Found: ${found}  |  Skipped: ${skipped}  |  Errors: ${dbErrors}`);
console.log(`  Hit rate:  ${((found / festivals.length) * 100).toFixed(1)}%`);
if (Object.keys(byPlatform).length) {
  console.log(`\n  By platform:`);
  Object.entries(byPlatform).sort((a, b) => b[1] - a[1]).forEach(([p, n]) => console.log(`    ${p.padEnd(18)} ${n}`));
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
