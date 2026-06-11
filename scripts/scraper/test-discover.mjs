/**
 * Dry-run discovery test. Does NOT write to the database.
 * Shows exactly what the scraper would find and stage.
 *
 * Usage:
 *   node test-discover.mjs
 *   node test-discover.mjs --source="https://americanamusic.org/news"
 */

import * as cheerio from "cheerio";
import { fetchPage } from "./lib/fetch-page.mjs";
import { extractFestivalInfo } from "./lib/extract-festival.mjs";

const FESTIVAL_LINK_KEYWORDS = [
  "festival", "music", "call", "submission", "apply", "open call",
  "showcase", "performance", "opportunity", "residency",
];
const SKIP_PATTERNS = [
  /\/(about|contact|privacy|terms|faq|login|signup|register|search|tag|category|page\/\d)/i,
  /^(mailto|tel|javascript):/i,
  /#$/,
];

const SOURCES = [
  { name: "Musical America",             url: "https://www.musicalamerica.com/news/" },
  { name: "Ditto Music Blog",            url: "https://dittomusic.com/en/blog/" },
  { name: "iMusician Blog",              url: "https://imusician.pro/en/resources/blog/" },
  { name: "CD Baby DIY Musician",        url: "https://diymusician.cdbaby.com/" },
  { name: "Hypebot",                     url: "https://www.hypebot.com/hypebot/" },
  { name: "Bandzoogle Blog",             url: "https://bandzoogle.com/blog/" },
  { name: "Music Week Talent",           url: "https://www.musicweek.com/talent/" },
  { name: "Americana Music Association", url: "https://americanamusic.org/news" },
  { name: "Help Musicians UK",           url: "https://helpmusicians.org.uk/news/" },
  { name: "CaFE – Call for Entry",       url: "https://www.callforentry.org/" },
  { name: "Jazz Corner",                 url: "https://www.jazzcorner.com/" },
  { name: "Songwriting Magazine UK",     url: "https://www.songwritingmagazine.co.uk/competitions/" },
  { name: "Sentric Music Blog",          url: "https://sentricmusic.com/blog/" },
  { name: "SongKick Festivals",          url: "https://www.songkick.com/festivals" },
  { name: "BBC Introducing",             url: "https://www.bbc.co.uk/music/introducing" },
  { name: "DIY Magazine Artists",        url: "https://diymag.com/artists/" },
  { name: "Indie Bible Blog",            url: "https://indiebible.com/blog/" },
];

const singleSource = process.argv.find((a) => a.startsWith("--source="))?.replace("--source=", "");

const toTest = singleSource
  ? [{ name: "custom", url: singleSource }]
  : SOURCES;

let totalSources = 0, totalLinks = 0, totalStaged = 0;
const wouldStage = [];

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
  totalLinks += links.length;
  console.log(`   → ${links.length} candidate links`);

  // Sample up to 5 links per source to keep the test fast.
  const sample = links.slice(0, 5);

  for (const link of sample) {
    const { html: pageHtml } = await fetchPage(link);
    if (!pageHtml) continue;

    if (looksLikeListingPage(pageHtml)) continue;

    const info = extractFestivalInfo(pageHtml, link);
    if (!info.festival_name) continue;

    totalStaged++;
    wouldStage.push(info);
    const deadline = info.submission_deadline ? `deadline: ${info.submission_deadline}` : "no deadline found";
    console.log(`   + "${info.festival_name}" | ${info.city ?? "??"}, ${info.country ?? "??"} | ${deadline}`);
  }
}

console.log("\n" + "═".repeat(60));
console.log(`Sources scanned:          ${totalSources} / ${toTest.length}`);
console.log(`Candidate links found:    ${totalLinks}`);
console.log(`Would stage (5-link cap): ${totalStaged}`);
console.log("═".repeat(60));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractCandidateLinks(html, sourceUrl) {
  const $ = cheerio.load(html);
  const base = new URL(sourceUrl);
  const seen = new Set();
  const links = [];

  $("a[href]").each((_, el) => {
    const text = ($(el).text() + " " + ($(el).attr("aria-label") ?? "")).toLowerCase();
    const href = $(el).attr("href") ?? "";
    if (SKIP_PATTERNS.some((re) => re.test(href))) return;
    const hasKw = FESTIVAL_LINK_KEYWORDS.some((kw) => text.includes(kw) || href.toLowerCase().includes(kw));
    if (!hasKw) return;
    try {
      const abs = new URL(href, base).href;
      if (!seen.has(abs)) { seen.add(abs); links.push(abs); }
    } catch {}
  });

  return links.slice(0, 30);
}

function looksLikeListingPage(html) {
  const $ = cheerio.load(html);
  return $("ul a, ol a").length > 60;
}
