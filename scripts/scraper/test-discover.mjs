/**
 * Dry-run discovery test. Does NOT write to the database.
 *
 * Usage:
 *   node test-discover.mjs
 *   node test-discover.mjs --source="https://..."
 *   node test-discover.mjs --sample=10    # candidate links per source (default 6)
 *
 * Output: every candidate is printed individually — accepted with all fields,
 * rejected with the exact rejection reason. Aggregate summary at the end.
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
  /\/(musician|performer|profile|user|account|dashboard|my-|sign-?in)s?\//i,
];

const SOURCES = [
  { name: "Artist Communities Alliance",           url: "https://www.artistcommunities.org/directory/open-calls" },
  { name: "Music Export Denmark",                  url: "https://musicexportdenmark.dk/funding-opportunities/" },
  { name: "Arts Council of Northern Ireland",      url: "https://www.artscouncil-ni.org/funding/" },
  { name: "SMIA – Award Submissions",              url: "https://www.smia.org.uk/opportunity-type/award-submissions/" },
  { name: "Sound and Music (UK)",                  url: "https://soundandmusic.org/opportunities/" },
  { name: "PRS Foundation – Open Fund",            url: "https://prsfoundation.com/funding-support/funding-for-music-creators/open-fund/" },
  { name: "PRS Foundation – Early Career",         url: "https://prsfoundation.com/funding-support/funding-for-music-creators/early-career/" },
  { name: "SXSW Music Applications",               url: "https://www.sxsw.com/applications/music/" },
  { name: "AmericanaFest",                          url: "https://americanamusic.org/" },
  { name: "The Great Escape Festival",             url: "https://greatescapefestival.com/" },
  { name: "Songwriting Magazine UK",               url: "https://www.songwritingmagazine.co.uk/competitions/" },
  { name: "International Songwriting Competition", url: "https://www.songwritingcompetition.com/" },
  { name: "Independent Music Awards",              url: "https://www.independentmusicawards.com/" },
];

const singleSource = process.argv.find(a => a.startsWith("--source="))?.replace("--source=", "");
const sampleSize   = parseInt(process.argv.find(a => a.startsWith("--sample="))?.replace("--sample=", "") ?? "6", 10);
const toTest       = singleSource ? [{ name: "custom", url: singleSource }] : SOURCES;

// ── Collected records for the final table ─────────────────────────────────────
const allAccepted = [];
const allRejected = [];

// ── Main loop ─────────────────────────────────────────────────────────────────

for (const source of toTest) {
  console.log(`\n${"─".repeat(72)}`);
  console.log(`SOURCE  ${source.name}`);
  console.log(`URL     ${source.url}`);
  console.log(`${"─".repeat(72)}`);

  const { html, status, error } = await fetchPage(source.url);
  if (!html) {
    console.log(`  ✗ fetch failed (status=${status}) ${error ?? ""}`);
    continue;
  }

  const links = extractCandidateLinks(html, source.url);
  console.log(`  ${links.length} candidate links found — sampling ${Math.min(links.length, sampleSize)}\n`);

  const sample = links.slice(0, sampleSize);

  for (const link of sample) {
    const { html: pageHtml } = await fetchPage(link);
    if (!pageHtml) {
      console.log(`  ✗ FETCH FAILED  ${link}`);
      allRejected.push({ source: source.name, url: link, reason: "fetch failed", info: null });
      continue;
    }

    if (looksLikeListingPage(pageHtml)) {
      console.log(`  ✗ LISTING PAGE  ${link}`);
      allRejected.push({ source: source.name, url: link, reason: "listing/directory page (>60 nav links)", info: null });
      continue;
    }

    const info = extractFestivalInfo(pageHtml, link);
    const { confidence, accept, reason } = classifyPage(link, info);

    if (accept) {
      printAccepted(source.name, link, info, confidence);
      allAccepted.push({ source: source.name, url: link, confidence, info });
    } else {
      printRejected(source.name, link, info, confidence, reason);
      allRejected.push({ source: source.name, url: link, reason, info });
    }
  }
}

// ── Final tables ───────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(72)}`);
console.log(`ACCEPTED RECORDS — ${allAccepted.length} total`);
console.log(`${"═".repeat(72)}`);

if (allAccepted.length === 0) {
  console.log("  (none)");
} else {
  for (let i = 0; i < allAccepted.length; i++) {
    const { source, url, confidence, info } = allAccepted[i];
    console.log(`\n  [${String(i + 1).padStart(2, "0")}] confidence=${confidence}`);
    console.log(`       title      : ${info.festival_name ?? "(none)"}`);
    console.log(`       country    : ${info.country ?? "(none)"}`);
    console.log(`       city       : ${info.city ?? "(none)"}`);
    console.log(`       genre      : ${info.genre ?? "(none)"}`);
    console.log(`       deadline   : ${info.submission_deadline ?? "(none)"}`);
    console.log(`       website    : ${info.website ?? "(none)"}`);
    console.log(`       apply URL  : ${info.application_url ?? "(none)"}`);
    console.log(`       source     : ${source}`);
    console.log(`       page URL   : ${url}`);
  }
}

console.log(`\n${"═".repeat(72)}`);
console.log(`REJECTED RECORDS — ${allRejected.length} total`);
console.log(`${"═".repeat(72)}`);

for (let i = 0; i < allRejected.length; i++) {
  const { source, url, reason, info } = allRejected[i];
  const name = info?.festival_name ? `"${info.festival_name}"` : "(no title extracted)";
  console.log(`\n  [${String(i + 1).padStart(2, "0")}] ${name}`);
  console.log(`       reason  : ${reason}`);
  console.log(`       country : ${info?.country ?? "(none)"}`);
  console.log(`       city    : ${info?.city ?? "(none)"}`);
  console.log(`       source  : ${source}`);
  console.log(`       url     : ${url}`);
}

console.log(`\n${"═".repeat(72)}`);
console.log(`SUMMARY  (threshold ≥${ACCEPT_THRESHOLD})`);
console.log(`${"═".repeat(72)}`);
console.log(`  Sources scanned    : ${toTest.length}`);
console.log(`  Candidates sampled : ${allAccepted.length + allRejected.length}`);
console.log(`  Accepted           : ${allAccepted.length}`);
console.log(`  Rejected           : ${allRejected.length}`);
if (allAccepted.length > 0) {
  const withCountry = allAccepted.filter(r => r.info.country).length;
  const withDeadline = allAccepted.filter(r => r.info.submission_deadline).length;
  console.log(`  Has country        : ${withCountry} / ${allAccepted.length}`);
  console.log(`  Has deadline       : ${withDeadline} / ${allAccepted.length}`);
}

if (allAccepted.length < 20) {
  console.log(`\n  ⚠ Only ${allAccepted.length} accepted records — fewer than the target of 20.`);
  console.log(`    Consider increasing --sample or adding higher-yield sources.`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function printAccepted(sourceName, link, info, confidence) {
  console.log(`  ✓ ACCEPTED [${confidence}]`);
  console.log(`      title    : ${info.festival_name ?? "(none)"}`);
  console.log(`      country  : ${info.country ?? "(none)"}`);
  console.log(`      city     : ${info.city ?? "(none)"}`);
  console.log(`      deadline : ${info.submission_deadline ?? "(none)"}`);
  console.log(`      apply    : ${info.application_url ?? "(none)"}`);
  console.log(`      url      : ${link}`);
}

function printRejected(sourceName, link, info, confidence, reason) {
  const name = info?.festival_name ? `"${info.festival_name}"` : "(no title)";
  console.log(`  ✗ REJECTED [${confidence}]  ${name}`);
  console.log(`      reason   : ${reason}`);
  console.log(`      country  : ${info?.country ?? "(none)"}`);
  console.log(`      city     : ${info?.city ?? "(none)"}`);
  console.log(`      url      : ${link}`);
}

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
