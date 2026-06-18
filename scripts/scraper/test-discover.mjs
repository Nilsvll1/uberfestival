/**
 * Festival pipeline test. Does NOT write to the database.
 *
 * Tests the Wikipedia list parser and festival directory scrapers by
 * sampling a few sources and showing what would be staged.
 *
 * Usage:
 *   node test-discover.mjs                           # sample Wikipedia + directory sources
 *   node test-discover.mjs --source=wikipedia        # Wikipedia sources only
 *   node test-discover.mjs --source=directory        # directory sources only
 *   node test-discover.mjs --url="https://..."       # test a single URL
 *   node test-discover.mjs --sample=10               # festivals per source (default 8)
 *
 * For a full Wikidata dry-run, use:
 *   node dry-run.mjs
 */

import { fetchWikipediaFestivalList, WIKIPEDIA_FESTIVAL_LISTS } from "./scrapers/wikipedia-festivals.mjs";
import { fetchPage }      from "./lib/fetch-page.mjs";
import { validateFestival } from "./lib/validate-festival.mjs";
import { extractFestivalFromPage } from "./scrapers/extract-from-page.mjs";

const args       = process.argv.slice(2);
const sourceFilter = args.find(a => a.startsWith("--source="))?.split("=")[1] ?? "all";
const singleUrl  = args.find(a => a.startsWith("--url="))?.split("=")[1];
const sampleSize = parseInt(args.find(a => a.startsWith("--sample="))?.split("=")[1] ?? "8", 10);

console.log(`\n${"═".repeat(72)}`);
console.log(`  UberFestival — Pipeline Test (no DB writes)`);
console.log(`${"═".repeat(72)}\n`);

const accepted = [];
const rejected = [];

// ── Custom URL ────────────────────────────────────────────────────────────────

if (singleUrl) {
  console.log(`Testing single URL: ${singleUrl}\n`);

  // Try as Wikipedia list first
  if (singleUrl.includes("wikipedia.org/wiki/List_of")) {
    const festivals = await fetchWikipediaFestivalList({ url: singleUrl, country: null });
    processResults(festivals, "custom wikipedia list", singleUrl);
  } else {
    // Festival directory page
    const { html, error } = await fetchPage(singleUrl);
    if (!html) {
      console.log(`✗ fetch failed: ${error}`);
    } else {
      const festival = extractFestivalFromPage(html, singleUrl);
      processResults([festival], "custom directory page", singleUrl);
    }
  }

// ── Wikipedia sources ─────────────────────────────────────────────────────────

} else {
  if (sourceFilter === "all" || sourceFilter === "wikipedia") {
    const wikiSample = WIKIPEDIA_FESTIVAL_LISTS.slice(0, 5); // test first 5 pages
    console.log(`Testing ${wikiSample.length} Wikipedia list pages (sample):\n`);

    for (const source of wikiSample) {
      console.log(`─── ${source.country ?? "Global"} — ${source.url}`);
      const festivals = await fetchWikipediaFestivalList(source);
      processResults(festivals.slice(0, sampleSize), `Wikipedia: ${source.country}`, source.url);
      console.log();
    }
  }

  if (sourceFilter === "all" || sourceFilter === "directory") {
    // Example: test a known festival directory
    const testDirs = [
      { name: "MusicFestivalWizard (NA)", url: "https://www.musicfestivalwizard.com/all-festivals/" },
      { name: "eFestivals (UK)",          url: "https://www.efestivals.co.uk/festivals/" },
    ];

    for (const dir of testDirs) {
      console.log(`─── ${dir.name} — ${dir.url}`);
      const { html, error } = await fetchPage(dir.url);
      if (!html) {
        console.log(`  ✗ fetch failed: ${error}\n`);
        continue;
      }
      console.log(`  fetched OK\n`);
    }
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`${"═".repeat(72)}`);
console.log(`ACCEPTED — ${accepted.length} festivals`);
console.log(`${"═".repeat(72)}`);

for (let i = 0; i < Math.min(accepted.length, 30); i++) {
  const { source, festival: r } = accepted[i];
  console.log(`\n  [${String(i + 1).padStart(2, "0")}] ${r.festival_name}`);
  console.log(`       Country : ${r.country           ?? "(unknown)"}`);
  console.log(`       City    : ${r.city               ?? "(unknown)"}`);
  console.log(`       Website : ${r.official_website   ?? "(unknown)"}`);
  console.log(`       Genre   : ${r.genre              ?? "(unknown)"}`);
  console.log(`       Source  : ${source}`);
}

if (accepted.length > 30) {
  console.log(`\n  ... and ${accepted.length - 30} more`);
}

console.log(`\n${"═".repeat(72)}`);
console.log(`REJECTED — ${rejected.length} records`);
console.log(`${"═".repeat(72)}`);

const reasons = {};
for (const { reason } of rejected) {
  const key = reason.replace(/: ".*"/, "");
  reasons[key] = (reasons[key] ?? 0) + 1;
}
Object.entries(reasons)
  .sort((a, b) => b[1] - a[1])
  .forEach(([r, n]) => console.log(`  ${String(n).padStart(4)}  ${r}`));

console.log(`\n${"═".repeat(72)}`);
console.log(`TOTALS`);
console.log(`${"═".repeat(72)}`);
console.log(`  Accepted : ${accepted.length}`);
console.log(`  Rejected : ${rejected.length}`);
console.log(`  Total    : ${accepted.length + rejected.length}`);

// ── Helpers ───────────────────────────────────────────────────────────────────

function processResults(festivals, sourceName, sourceUrl) {
  for (const festival of festivals) {
    const { valid, reason } = validateFestival(festival);
    if (valid) {
      accepted.push({ source: sourceName, url: sourceUrl, festival });
    } else {
      rejected.push({ source: sourceName, url: sourceUrl, festival, reason });
    }
  }
}
