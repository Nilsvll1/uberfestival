/**
 * Dry-run discovery test. Does NOT write to the database.
 * Runs the full quality gate (classify-page) and reports detailed metrics.
 *
 * Usage:
 *   node test-discover.mjs
 *   node test-discover.mjs --source="https://americanamusic.org/news"
 *   node test-discover.mjs --sample=10    # links per source (default 5)
 */

import * as cheerio from "cheerio";
import { fetchPage } from "./lib/fetch-page.mjs";
import { extractFestivalInfo } from "./lib/extract-festival.mjs";
import { classifyPage, ACCEPT_THRESHOLD } from "./lib/classify-page.mjs";

const FESTIVAL_LINK_KEYWORDS = [
  "festival", "music", "call", "submission", "apply", "open call",
  "showcase", "performance", "opportunity", "residency",
  "grant", "award", "competition", "fund",
];
const SKIP_PATTERNS = [
  /\/(about|contact|privacy|terms|faq|login|signup|register|search|tag|category|page\/\d)/i,
  /^(mailto|tel|javascript):/i,
  /#$/,
  // Profile and account pages — musician bios, user dashboards, auth
  /\/(musician|performer|profile|user|account|dashboard|my-|sign-?in)s?\//i,
];

const SOURCES = [
  // Artist residency open calls — largest source (~120 individual pages, global)
  { name: "Artist Communities Alliance",         url: "https://www.artistcommunities.org/directory/open-calls" },
  // Music export & national showcase programs
  { name: "Music Export Denmark",                url: "https://musicexportdenmark.dk/funding-opportunities/" },
  // National arts funding bodies
  { name: "Arts Council of Northern Ireland",    url: "https://www.artscouncil-ni.org/funding/" },
  { name: "SMIA – Award Submissions",            url: "https://www.smia.org.uk/opportunity-type/award-submissions/" },
  { name: "Sound and Music (UK)",                url: "https://soundandmusic.org/opportunities/" },
  { name: "PRS Foundation – Open Fund",          url: "https://prsfoundation.com/funding-support/funding-for-music-creators/open-fund/" },
  { name: "PRS Foundation – Early Career",       url: "https://prsfoundation.com/funding-support/funding-for-music-creators/early-career/" },
  // Help Musicians UK removed: produces support/service page false positives.
  // Major festival & showcase applications
  { name: "SXSW Music Applications",            url: "https://www.sxsw.com/applications/music/" },
  { name: "AmericanaFest",                       url: "https://americanamusic.org/" },
  { name: "The Great Escape Festival",           url: "https://greatescapefestival.com/" },
  // Competitions & awards
  { name: "Songwriting Magazine UK",             url: "https://www.songwritingmagazine.co.uk/competitions/" },
  { name: "International Songwriting Competition", url: "https://www.songwritingcompetition.com/" },
  { name: "Independent Music Awards",            url: "https://www.independentmusicawards.com/" },
];

const singleSource = process.argv
  .find(a => a.startsWith("--source="))
  ?.replace("--source=", "");
const sampleSize = parseInt(
  process.argv.find(a => a.startsWith("--sample="))?.replace("--sample=", "") ?? "5",
  10
);

const toTest = singleSource
  ? [{ name: "custom", url: singleSource }]
  : SOURCES;

// ── Counters ─────────────────────────────────────────────────────────────────
let totalSources   = 0;
let totalCandidates = 0;

const rejected = {
  domain:    0,
  path:      0,
  noFields:  0,  // missing festival_name or website
  noSignals: 0,  // low confidence — no opportunity signals
  toolSaaS:  0,  // low confidence — SaaS/tool signals
  lowConf:   0,  // low confidence — other
};
let accepted       = 0;
let missingCountry = 0;
let mapReady       = 0;  // has country (can be geocoded to a map marker)

const accepted_samples = [];

// ── Main loop ─────────────────────────────────────────────────────────────────

for (const source of toTest) {
  console.log(`\n── ${source.name}`);
  console.log(`   ${source.url}`);

  const { html, status, error } = await fetchPage(source.url);
  if (!html) {
    console.log(`   ✗ fetch failed (status=${status}) ${error ?? ""}`);
    continue;
  }

  totalSources++;
  const links = extractCandidateLinks(html, source.url);
  totalCandidates += links.length;
  console.log(`   → ${links.length} candidate links found`);

  const sample = links.slice(0, sampleSize);

  for (const link of sample) {
    const { html: pageHtml } = await fetchPage(link);
    if (!pageHtml) continue;

    if (looksLikeListingPage(pageHtml)) continue;

    const info = extractFestivalInfo(pageHtml, link);
    const { confidence, accept, reason } = classifyPage(link, info);

    if (!accept) {
      // Classify rejection reason for the report.
      if (reason.startsWith("blocked domain")) {
        rejected.domain++;
      } else if (reason.startsWith("no festival_name") || reason.startsWith("no website")) {
        rejected.noFields++;
      } else if (reason.includes("non-opportunity path")) {
        rejected.path++;
      } else if (reason.includes("SaaS") || reason.includes("tool signal")) {
        rejected.toolSaaS++;
      } else if (reason.includes("no opportunity signals")) {
        rejected.noSignals++;
      } else {
        rejected.lowConf++;
      }
      console.log(`   ✗ [${confidence}] ${link}`);
      console.log(`         ${reason}`);
    } else {
      accepted++;
      if (!info.country) missingCountry++;
      else mapReady++;

      const geoStr    = [info.city, info.country].filter(Boolean).join(", ") || "no geo ⚠";
      const deadlineStr = info.submission_deadline ? `deadline: ${info.submission_deadline}` : "no deadline";
      const applyStr  = info.application_url ? "apply URL ✓" : "no apply URL";
      console.log(`   + [${confidence}] "${info.festival_name}" | ${geoStr} | ${deadlineStr} | ${applyStr}`);
      accepted_samples.push({ name: info.festival_name, confidence, country: info.country, city: info.city });
    }
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

const totalRejected = Object.values(rejected).reduce((a, b) => a + b, 0);

console.log("\n" + "═".repeat(68));
console.log(`DISCOVERY DRY-RUN REPORT (threshold: ≥${ACCEPT_THRESHOLD})`);
console.log("═".repeat(68));
console.log(`Sources scanned:          ${totalSources} / ${toTest.length}`);
console.log(`Candidates found:         ${totalCandidates}  (${sampleSize}/source sampled)`);
console.log(`  Sampled for inspection: ${accepted + totalRejected}`);
console.log("");
console.log(`Rejected:                 ${totalRejected}`);
console.log(`  ↳ Blocked domain:       ${rejected.domain}`);
console.log(`  ↳ Article/tool path:    ${rejected.path}`);
console.log(`  ↳ Missing name/URL:     ${rejected.noFields}`);
console.log(`  ↳ No opportunity signal:${rejected.noSignals}`);
console.log(`  ↳ SaaS/tool signals:    ${rejected.toolSaaS}`);
console.log(`  ↳ Low confidence other: ${rejected.lowConf}`);
console.log("");
console.log(`Accepted:                 ${accepted}`);
console.log(`  ↳ Has country (map-ready):  ${mapReady}`);
console.log(`  ↳ Missing country:          ${missingCountry}`);
console.log("═".repeat(68));

if (missingCountry > 0) {
  console.log("\n⚠ Map note: entries without country cannot be geocoded.");
  console.log("  They will appear in festival_staging but receive lat=0 lon=0");
  console.log("  when approved. Admin should fill in country/city before approving.");
}

if (accepted > 0) {
  console.log(`\nAccepted samples (${Math.min(accepted, 10)} shown):`);
  for (const s of accepted_samples.slice(0, 10)) {
    const geo = [s.city, s.country].filter(Boolean).join(", ") || "— no geo";
    console.log(`  [${s.confidence}] ${s.name} (${geo})`);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractCandidateLinks(html, sourceUrl) {
  const $ = cheerio.load(html);
  const base = new URL(sourceUrl);
  const seen = new Set();
  const links = [];

  $("a[href]").each((_, el) => {
    const text = ($(el).text() + " " + ($(el).attr("aria-label") ?? "")).toLowerCase();
    const href = $(el).attr("href") ?? "";
    if (SKIP_PATTERNS.some(re => re.test(href))) return;
    const hasKw = FESTIVAL_LINK_KEYWORDS.some(kw => text.includes(kw) || href.toLowerCase().includes(kw));
    if (!hasKw) return;
    try {
      const abs = new URL(href, base).href;
      if (!seen.has(abs)) { seen.add(abs); links.push(abs); }
    } catch { /* ignore */ }
  });

  return links.slice(0, 30);
}

function looksLikeListingPage(html) {
  const $ = cheerio.load(html);
  return $("ul a, ol a").length > 60;
}
