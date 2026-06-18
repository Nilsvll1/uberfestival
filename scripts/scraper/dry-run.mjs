/**
 * Festival database dry-run.
 *
 * Queries Wikidata for real music festivals, shows 30 samples with all
 * required fields. DOES NOT write to the database.
 *
 * Usage:
 *   node dry-run.mjs               # 30 samples from Wikidata
 *   node dry-run.mjs --all         # show all fetched records
 *   node dry-run.mjs --limit=50    # show N samples
 *
 * If any result is not an actual music festival, stop and redesign the pipeline.
 */

import { fetchWikidataFestivals } from "./scrapers/wikidata-festivals.mjs";
import { validateFestival }       from "./lib/validate-festival.mjs";

const args    = process.argv.slice(2);
const showAll = args.includes("--all");
const limit   = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "30", 10);

console.log(`\n${"═".repeat(76)}`);
console.log(`  UberFestival — Festival Database Dry-Run`);
console.log(`  ${new Date().toISOString()}`);
console.log(`${"═".repeat(76)}\n`);

// ── 1. Fetch from Wikidata ────────────────────────────────────────────────────

const raw = await fetchWikidataFestivals();

// ── 2. Validate ───────────────────────────────────────────────────────────────

const accepted = [];
const rejected = [];

for (const record of raw) {
  const { valid, reason } = validateFestival(record);
  if (valid) {
    accepted.push(record);
  } else {
    rejected.push({ record, reason });
  }
}

// ── 3. Rank by completeness ───────────────────────────────────────────────────
// Prioritise records with the most fields filled in.

function scoreRecord(r) {
  let s = 0;
  if (r.official_website)    s += 30;
  if (r.latitude != null)    s += 25;
  if (r.country)             s += 20;
  if (r.city)                s += 15;
  if (r.genre)               s += 10;
  return s;
}

accepted.sort((a, b) => scoreRecord(b) - scoreRecord(a));

const sample = showAll ? accepted : accepted.slice(0, limit);

// ── 4. Print samples ──────────────────────────────────────────────────────────

console.log(`SAMPLE FESTIVALS — showing ${sample.length} of ${accepted.length} accepted\n`);

for (let i = 0; i < sample.length; i++) {
  const r = sample[i];
  const lat = r.latitude  != null ? `${r.latitude.toFixed(4)}°` : "(unknown)";
  const lng = r.longitude != null ? `${r.longitude.toFixed(4)}°` : "(unknown)";
  const coords = r.latitude != null ? `${lat}, ${lng}` : "(no coordinates)";

  console.log(`[${String(i + 1).padStart(2, "0")}] ${r.festival_name}`);
  console.log(`     Country  : ${r.country              ?? "(unknown)"}`);
  console.log(`     City     : ${r.city                 ?? "(unknown)"}`);
  console.log(`     Website  : ${r.official_website     ?? "(unknown)"}`);
  console.log(`     Start    : ${r.festival_start_date  ?? "(unknown)"}`);
  console.log(`     End      : ${r.festival_end_date    ?? "(unknown)"}`);
  console.log(`     Coords   : ${coords}`);
  console.log(`     Genre    : ${r.genre                ?? "(unknown)"}`);
  console.log();
}

// ── 5. Stats ──────────────────────────────────────────────────────────────────

const withWebsite = accepted.filter(r => r.official_website).length;
const withCoords  = accepted.filter(r => r.latitude != null).length;
const withCountry = accepted.filter(r => r.country).length;
const withCity    = accepted.filter(r => r.city).length;
const withGenre   = accepted.filter(r => r.genre).length;
const withDates   = accepted.filter(r => r.festival_start_date).length;

console.log(`${"═".repeat(76)}`);
console.log(`SUMMARY`);
console.log(`${"═".repeat(76)}`);
console.log(`  Total fetched from Wikidata : ${raw.length}`);
console.log(`  Valid festivals             : ${accepted.length}`);
console.log(`  Rejected (non-festival)     : ${rejected.length}`);
console.log();
console.log(`  Field completeness (of ${accepted.length} accepted):`);
console.log(`    Official website   : ${pct(withWebsite, accepted.length)}`);
console.log(`    Coordinates        : ${pct(withCoords,  accepted.length)}`);
console.log(`    Country            : ${pct(withCountry, accepted.length)}`);
console.log(`    City               : ${pct(withCity,    accepted.length)}`);
console.log(`    Genre              : ${pct(withGenre,   accepted.length)}`);
console.log(`    Dates              : ${pct(withDates,   accepted.length)}`);

if (rejected.length > 0) {
  console.log(`\n  Top rejection reasons:`);
  const reasons = {};
  for (const { reason } of rejected) {
    const key = reason.replace(/: ".*"/, "");
    reasons[key] = (reasons[key] ?? 0) + 1;
  }
  Object.entries(reasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([r, n]) => console.log(`    ${String(n).padStart(4)}  ${r}`));
}

console.log(`\n  Note: dates are not stored in Wikidata per edition.`);
console.log(`  They will be populated by fetching each festival's official website.`);
console.log(`\n  ✓ If every record above is a real festival, run the full scraper.`);
console.log(`    Command: node index.mjs --mode=discover\n`);

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(n, total) {
  return `${n} / ${total} (${total ? Math.round((n / total) * 100) : 0}%)`;
}
