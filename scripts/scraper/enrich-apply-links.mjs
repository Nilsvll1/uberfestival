/**
 * Apply Links Enrichment — Phase: Actionability
 *
 * For each target festival, discovers and stores the official application URL,
 * the platform it lives on, confidence score, and discovery source.
 *
 * Strategy (in priority order):
 *   A. Homepage crawl — score every link by URL pattern + link text
 *   B. Follow top candidate — confirm it is an apply page (form / title / H1)
 *   C. Direct URL guessing — try /apply, /submit, /artists/apply, etc.
 *   D. Platform checks — FilmFreeway direct slug, Festhome, Submittable
 *
 * Quality rules enforced:
 *   - Never store the festival homepage as application_url
 *   - Minimum confidence 0.50 to store anything
 *   - application_source records how we found the link
 *   - application_verified_at set to NOW() on every successful write
 *
 * Usage:
 *   node --env-file=.env enrich-apply-links.mjs               # top 300
 *   node --env-file=.env enrich-apply-links.mjs --dry-run     # preview
 *   node --env-file=.env enrich-apply-links.mjs --limit=20    # first N
 *   node --env-file=.env enrich-apply-links.mjs --report      # stats only
 *   node --env-file=.env enrich-apply-links.mjs --id=42       # single festival
 */

import { readFileSync }  from "fs";
import { db }            from "./lib/supabase.mjs";
import { fetchPage }     from "./lib/fetch-page.mjs";

const args     = process.argv.slice(2);
const DRY_RUN  = args.includes("--dry-run");
const REPORT   = args.includes("--report");
const limitArg = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "0", 10);
const idArg    = parseInt(args.find(a => a.startsWith("--id="))?.split("=")[1] ?? "0", 10);

const CONCURRENCY  = 2;
const FETCH_DELAY  = 1200;
const USER_AGENT   = "Mozilla/5.0 (compatible; UberFestivalBot/1.0; +https://uberfestival.com)";

// ── Scoring weights ───────────────────────────────────────────────────────────

// URL path segments that strongly indicate an apply page
const URL_APPLY = [
  [/\/apply(?:\/|$|-to-|-for-|-now|-here|-online)/i, 22],
  [/\/applications?(?:\/|$|-)/i, 20],
  [/\/submit(?:\/|$|-)/i, 18],
  [/\/submissions?(?:\/|$|-)/i, 16],
  [/\/call-for[-_]/i, 16],
  [/\/open-call/i, 16],
  [/\/entries(?:\/|$|-)/i, 14],
  [/\/entry(?:\/|$|-)/i, 12],
  [/\/audition/i, 12],
  [/\/register(?:\/|$|-)/i, 10],
  [/\/registration(?:\/|$|-)/i, 10],
  [/\/participate/i, 8],
  [/\/artists?(?:\/|-)(apply|submit|entry|form)/i, 20],
  [/\/bands?[-_](apply|submit|entry)/i, 20],
  [/\/film[-_](apply|submit|entry)/i, 18],
  [/\/performers?[-_](apply|submit)/i, 16],
];

// Third-party platforms — these alone are sufficient evidence
const PLATFORM_PATTERNS = [
  [/filmfreeway\.com/i,                 "filmfreeway",  24],
  [/festhome\.com/i,                    "festhome",     22],
  [/eventival\.com/i,                   "eventival",    22],
  [/apply\.submittable\.com/i,          "submittable",  22],
  [/form\.jotform\.com|jotform\.com\/\d/i, "jotform",  20],
  [/typeform\.com\/to\//i,              "typeform",     20],
  [/docs\.google\.com\/forms/i,         "google_forms", 18],
  [/wufoo\.com\/forms/i,                "wufoo",        18],
  [/cognito\.forms\.com/i,              "cognito",      16],
  [/formstack\.com/i,                   "formstack",    16],
  [/airtable\.com\/shr/i,               "airtable",     16],
];

// Link text patterns that signal application content
const TEXT_APPLY = [
  [/\bapply\b/i, 18], [/\bapplication\b/i, 16], [/\bsubmit\b/i, 14],
  [/\bsubmission\b/i, 12], [/call.for.entr/i, 16], [/call.for.artist/i, 16],
  [/open.call\b/i, 14], [/\bregister\b/i, 10], [/\baudition/i, 12],
  [/\bentries\b/i, 10], [/\bentry\b/i, 8], [/\bparticipate\b/i, 6],
  [/for.artists?\b/i, 8], [/for.bands?\b/i, 8], [/for.performers?\b/i, 8],
  [/for.musicians?\b/i, 8], [/for.filmmakers?\b/i, 8],
];

// Link text / URL patterns that indicate it is NOT an apply page
const REJECT_TEXT = [/\bnews\b/i, /\bblog\b/i, /\bshop\b/i, /\bticket/i,
  /\bschedule\b/i, /\blineup\b/i, /\bmap\b/i, /\bfaq\b/i, /\bcontact\b/i,
  /\babout\b/i, /\bsponsors?\b/i, /\bpress\b/i, /\bmerchandise\b/i];

// Paths to try directly if homepage crawl finds nothing
const GUESS_PATHS = [
  "/apply", "/apply-to-play", "/apply-to-perform", "/artist-applications",
  "/artists/apply", "/artists/applications", "/band-applications",
  "/submit", "/submissions", "/submit-your-band", "/submit-your-film",
  "/call-for-entries", "/call-for-artists", "/open-call",
  "/entries", "/enter", "/auditions", "/participate",
  "/performer-application", "/music-submissions", "/film-submissions",
];

// ── Apply page content confirmation keywords ──────────────────────────────────

const APPLY_PAGE_CONFIRM = [
  /apply\s+now/i, /\bapplication\b/i, /\bsubmit\b/i, /\bsubmission\b/i,
  /call.for.entr/i, /call.for.artists?/i, /open.call/i, /\baudition/i,
  /\bentry\s+form\b/i, /\bregistration\s+form\b/i, /how\s+to\s+apply/i,
  /artists?\s+submission/i, /film\s+submission/i, /band\s+application/i,
];

const STATUS_OPEN   = [/\bnow\s+open\b/i, /\bopen\s+for\s+(submissions?|applications?|entr)/i, /\baccepting\s+(submissions?|applications?|entr)/i, /\bsubmit\s+now\b/i, /apply\s+now/i];
const STATUS_CLOSED = [/\bsubmissions?\s+(are\s+)?(now\s+)?closed\b/i, /\bno\s+longer\s+accepting\b/i, /\bapplications?\s+closed\b/i, /\bdeadline\s+has\s+passed\b/i, /\bregistrations?\s+(are\s+)?closed\b/i];

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(72)}`);
console.log(`  UberFestival — Apply Links Enrichment${DRY_RUN ? "  [DRY RUN]" : ""}`);
console.log(`  ${new Date().toISOString()}`);
console.log(`${"═".repeat(72)}\n`);

if (REPORT) { await printReport(); process.exit(0); }

const targets = await loadTargets();
console.log(`  Processing ${targets.length} festivals\n`);

const results = [];

for (let i = 0; i < targets.length; i += CONCURRENCY) {
  const batch = targets.slice(i, i + CONCURRENCY);
  const batchResults = await Promise.allSettled(batch.map(enrich));
  for (const r of batchResults) {
    if (r.status === "fulfilled" && r.value) results.push(r.value);
  }
  if (i + CONCURRENCY < targets.length) await sleep(FETCH_DELAY);
}

await printReport();
printSummary(results);

// ── Load targets ──────────────────────────────────────────────────────────────

async function loadTargets() {
  if (idArg) {
    const { data } = await db.from("festivals").select("*").eq("id", idArg).single();
    return data ? [data] : [];
  }

  // Load top 300 scored list
  const top300 = JSON.parse(readFileSync("/tmp/top300.json", "utf8"));
  const ids = top300.map(f => f.id);

  // Fetch full records in batches of 200
  let all = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from("festivals")
      .select("id, festival_name, category, country, website, application_url")
      .in("id", ids.slice(i, i + 200));
    if (data) all = all.concat(data);
  }

  // Keep only those still without application_url, in score order
  const sorted = ids
    .map(id => all.find(f => f.id === id))
    .filter(f => f && !f.application_url);

  return limitArg ? sorted.slice(0, limitArg) : sorted;
}

// ── Enrich one festival ───────────────────────────────────────────────────────

async function enrich(festival) {
  const baseUrl = normalizeUrl(festival.website);
  if (!baseUrl) return null;

  // Phase A+B: Homepage crawl → follow best candidate
  const crawlResult = await crawlForApplyLink(festival, baseUrl);
  if (crawlResult) return store(festival, crawlResult);

  // Phase C: Direct URL guessing
  const guessResult = await guessApplyUrl(festival, baseUrl);
  if (guessResult) return store(festival, guessResult);

  // Phase D: FilmFreeway / Festhome direct slug check
  const platformResult = await checkPlatforms(festival);
  if (platformResult) return store(festival, platformResult);

  console.log(`  — [${festival.id}] ${festival.festival_name.slice(0, 40)} — no apply link found`);
  return null;
}

// ── Phase A+B: Crawl homepage, follow best link ───────────────────────────────

async function crawlForApplyLink(festival, baseUrl) {
  const { html } = await fetchPage(baseUrl);
  if (!html) return null;

  const links = extractScoredLinks(html, baseUrl, festival.festival_name);
  if (!links.length) return null;

  // Try the top 3 candidates in score order
  for (const link of links.slice(0, 3)) {
    // Reject if it resolves to the homepage itself
    if (isSameUrl(link.url, baseUrl)) continue;

    // If it's a known third-party platform, trust it directly
    const platform = detectPlatform(link.url);
    if (platform !== "official") {
      const confidence = link.score >= 30 ? 0.88 : 0.72;
      return { url: link.url, platform, confidence, source: baseUrl, status: "unknown" };
    }

    // For internal links, confirm the page is actually about applying
    if (link.score >= 20) {
      const confirmed = await confirmApplyPage(link.url, festival.festival_name);
      if (confirmed) return { ...confirmed, source: baseUrl };
    }
  }

  return null;
}

// ── Phase C: Direct URL guessing ─────────────────────────────────────────────

async function guessApplyUrl(festival, baseUrl) {
  const origin = new URL(baseUrl).origin;

  for (const path of GUESS_PATHS) {
    const guessUrl = origin + path;
    try {
      const res = await withTimeout(
        fetch(guessUrl, { method: "HEAD", headers: { "User-Agent": USER_AGENT }, redirect: "follow" }),
        6000
      );
      if (!res.ok) continue;
      // HEAD succeeded — confirm it's an apply page AND belongs to this festival
      const confirmed = await confirmApplyPage(guessUrl, festival.festival_name);
      if (!confirmed) continue;
      // For guessed URLs, require the page actually mentions the festival name
      // to avoid generic /register or /apply pages on unrelated sites
      if (confirmed.platform === "official") {
        const { html } = await fetchPage(guessUrl);
        if (html && !nameAppearsOnPage(html, festival.festival_name, 0.5)) continue;
      }
      return { ...confirmed, confidence: Math.min(confirmed.confidence, 0.70), source: "url_guess:" + path };
    } catch { continue; }
  }
  return null;
}

// ── Phase D: Platform direct checks ──────────────────────────────────────────

async function checkPlatforms(festival) {
  const slug = toSlug(festival.festival_name);

  // FilmFreeway: try several common slug patterns
  const ffSlugs = [
    slug,
    slug.replace(/-festival$/, ""),
    slug + "-festival",
    slug.replace(/-/g, ""),
  ];

  for (const s of ffSlugs) {
    const url = `https://filmfreeway.com/${s}`;
    try {
      const res = await withTimeout(
        fetch(url, { headers: { "User-Agent": USER_AGENT }, redirect: "follow" }),
        8000
      );
      if (!res.ok || !res.url.includes("filmfreeway.com/")) continue;
      const html = await res.text();
      // Verify festival name appears prominently on the FF page
      if (!nameAppearsOnPage(html, festival.festival_name, 0.55)) continue;
      return {
        url: res.url, platform: "filmfreeway", confidence: 0.85,
        source: "filmfreeway_direct", status: "unknown",
      };
    } catch { continue; }
  }

  // Submittable: check if website links to submittable
  // (already would have been caught in crawl, so skip here)

  return null;
}

// ── Confirm apply page ────────────────────────────────────────────────────────

async function confirmApplyPage(url, festivalName) {
  const { html } = await fetchPage(url);
  if (!html) return null;

  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 6000);
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = (titleMatch?.[1] ?? "").toLowerCase();
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const h1 = (h1Match?.[1] ?? "").toLowerCase();

  // Count keyword hits
  const keywordHits = APPLY_PAGE_CONFIRM.filter(p => p.test(text) || p.test(title) || p.test(h1)).length;
  const hasForm = /<form\b/i.test(html);

  // Detect known third-party embed platforms in the page
  const platform = detectPlatform(url);

  // Thresholds
  if (keywordHits < 1 && !hasForm && platform === "official") return null;

  // Don't save if it's just a generic contact/booking page with low signal
  const isWeakSignal = keywordHits === 1 && !hasForm && !/apply|submit|entr/i.test(url);
  if (isWeakSignal) return null;

  const confidence = platform !== "official" ? 0.88
    : (hasForm && keywordHits >= 2) ? 0.85
    : (hasForm || keywordHits >= 2) ? 0.75
    : 0.60;

  const status = STATUS_OPEN.some(p => p.test(text)) ? "open"
    : STATUS_CLOSED.some(p => p.test(text)) ? "closed"
    : "unknown";

  return { url, platform, confidence, status };
}

// ── Link extraction and scoring ───────────────────────────────────────────────

function extractScoredLinks(html, baseUrl, festivalName) {
  const links = [];
  // Extract <a href> with their text content
  const aPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = aPattern.exec(html)) !== null) {
    const attrs = m[1];
    const inner = m[2].replace(/<[^>]+>/g, " ").trim();
    const href  = extractAttr(attrs, "href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;

    const resolved = resolveUrl(href, baseUrl);
    if (!resolved) continue;

    // Skip obvious non-apply links by text
    if (REJECT_TEXT.some(p => p.test(inner) || p.test(href))) continue;
    // Skip social media and newsletter/unsubscribe links
    if (/facebook\.com|instagram\.com|twitter\.com|youtube\.com|tiktok\.com/i.test(resolved)) continue;
    if (/list-manage\.com\/subscribe|mailchimp\.com\/subscribe|unsubscribe/i.test(resolved)) continue;

    let score = 0;

    // URL pattern scoring
    for (const [pat, pts] of URL_APPLY) if (pat.test(resolved)) score += pts;
    // Platform bonus
    for (const [pat, , pts] of PLATFORM_PATTERNS) if (pat.test(resolved)) score += pts;
    // Text scoring
    for (const [pat, pts] of TEXT_APPLY) if (pat.test(inner)) score += pts;
    // Navigation bonus: links in nav/header score higher
    // (naive check: already de-noised by REJECT_TEXT)

    if (score >= 8) links.push({ url: resolved, score, text: inner.slice(0, 60) });
  }

  return links.sort((a, b) => b.score - a.score);
}

// ── Store result ──────────────────────────────────────────────────────────────

async function store(festival, result) {
  if (result.confidence < 0.50) return null;

  const patch = {
    application_url:         result.url,
    application_platform:    result.platform,
    application_status:      result.status ?? "unknown",
    application_source:      result.source,
    application_confidence:  result.confidence,
    application_verified_at: new Date().toISOString(),
  };

  if (DRY_RUN) {
    console.log(`  [DRY] [${festival.id}] ${festival.festival_name.slice(0, 38).padEnd(38)} [${result.platform.padEnd(12)}] conf=${result.confidence.toFixed(2)} status=${result.status}`);
    console.log(`         → ${result.url.slice(0, 100)}`);
    console.log(`         ← ${result.source}`);
  } else {
    const { error } = await db.from("festivals").update(patch).eq("id", festival.id);
    if (error) { console.log(`  ERROR [${festival.id}]:`, error.message); return null; }
    console.log(`  ✓ [${festival.id}] ${festival.festival_name.slice(0, 38).padEnd(38)} [${result.platform.padEnd(12)}] conf=${result.confidence.toFixed(2)} ${result.status === "open" ? "✓OPEN" : ""}`);
  }

  return { festival, result };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectPlatform(url) {
  for (const [pat, name] of PLATFORM_PATTERNS) if (pat.test(url)) return name;
  return "official";
}

function normalizeUrl(website) {
  if (!website) return null;
  if (website.startsWith("http")) return website;
  return `https://${website}`;
}

function resolveUrl(href, base) {
  try {
    if (href.startsWith("//")) return "https:" + href;
    return new URL(href, base).href;
  } catch { return null; }
}

function isSameUrl(a, b) {
  try {
    const ua = new URL(a), ub = new URL(b);
    return ua.origin + ua.pathname.replace(/\/$/, "") ===
           ub.origin + ub.pathname.replace(/\/$/, "");
  } catch { return false; }
}

function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function nameAppearsOnPage(html, name, threshold = 0.6) {
  const text  = html.replace(/<[^>]+>/g, " ").toLowerCase();
  const words = name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const hits  = words.filter(w => text.includes(w)).length;
  return hits / words.length >= threshold;
}

function extractAttr(attrs, name) {
  const m = attrs.match(new RegExp(`${name}=["']([^"']+)["']`, "i"));
  return m?.[1]?.trim() ?? null;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Summary ───────────────────────────────────────────────────────────────────

function printSummary(results) {
  console.log(`\n${"═".repeat(72)}`);
  console.log("  ENRICHMENT SUMMARY");
  console.log(`${"═".repeat(72)}`);
  console.log(`  Processed:              ${results.length + (targets?.length ?? 0 - results.length)} festivals`);
  console.log(`  Apply links found:      ${results.length}`);

  const byPlatform = {};
  const byStatus = {};
  let highConf = 0;
  for (const r of results) {
    const p = r.result.platform;
    byPlatform[p] = (byPlatform[p] || 0) + 1;
    const s = r.result.status;
    byStatus[s] = (byStatus[s] || 0) + 1;
    if (r.result.confidence >= 0.80) highConf++;
  }

  console.log(`  High confidence (≥0.80): ${highConf}`);
  console.log(`\n  By platform:`);
  Object.entries(byPlatform).sort((a,b)=>b[1]-a[1]).forEach(([p,n]) =>
    console.log(`    ${p.padEnd(15)} ${n}`));
  console.log(`\n  By status:`);
  Object.entries(byStatus).sort((a,b)=>b[1]-a[1]).forEach(([s,n]) =>
    console.log(`    ${s.padEnd(15)} ${n}`));
}

async function printReport() {
  const [total, withApp, open, highConf] = await Promise.all([
    db.from("festivals").select("*", { count: "exact", head: true }),
    db.from("festivals").select("*", { count: "exact", head: true }).not("application_url", "is", null),
    db.from("festivals").select("*", { count: "exact", head: true }).eq("application_status", "open"),
    db.from("festivals").select("*", { count: "exact", head: true }).gte("application_confidence", 0.80),
  ]);

  const n = total.count ?? 0;
  const pct = v => n ? `${Math.round(v / n * 100)}%` : "—";

  console.log(`${"═".repeat(72)}`);
  console.log("  APPLICATION LINKS COVERAGE");
  console.log(`  ${new Date().toISOString()}`);
  console.log(`${"═".repeat(72)}`);
  console.log(`  Total festivals:         ${n}`);
  console.log(`  With application_url:    ${withApp.count ?? 0}  (${pct(withApp.count ?? 0)})`);
  console.log(`  Status = open:           ${open.count ?? 0}`);
  console.log(`  High confidence (≥0.80): ${highConf.count ?? 0}`);
  console.log();
}
