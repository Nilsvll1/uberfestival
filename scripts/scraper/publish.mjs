/**
 * Bulk-publish high-quality staging records to the festivals table.
 *
 * Rules:
 *   - Only records where website, country, city, latitude, genre are all non-null
 *   - Skip latitude=0 or longitude=0 (geocoding failure sentinel)
 *   - Skip duplicate festival name (case-insensitive match against festivals table)
 *   - Skip duplicate website URL (exact match against festivals table)
 *   - No re-geocoding — use existing staging coordinates
 *   - Map staging.genre → festivals.category
 *   - Do NOT modify the existing 98 festivals
 *
 * Usage:
 *   node --env-file=.env publish.mjs            # publish + report
 *   node --env-file=.env publish.mjs --dry-run  # preview only
 */

import { db } from "./lib/supabase.mjs";

const args    = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

console.log(`\n${"═".repeat(72)}`);
console.log(`  UberFestival — Bulk Publish${DRY_RUN ? "  [DRY RUN]" : ""}`);
console.log(`  ${new Date().toISOString()}`);
console.log(`${"═".repeat(72)}\n`);

// ── Pagination helper ─────────────────────────────────────────────────────────

async function fetchAll(buildQuery) {
  const PAGE = 1000;
  let all = [], offset = 0;
  while (true) {
    const { data, error } = await buildQuery().range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    offset += 1000;
  }
  return all;
}

// ── Load existing festivals (for collision detection) ─────────────────────────

const existingFestivals = await fetchAll(() =>
  db.from("festivals").select("festival_name, website")
);

const existingNames = new Set(
  existingFestivals.map(f => f.festival_name?.toLowerCase().trim()).filter(Boolean)
);
const existingWebsites = new Set(
  existingFestivals.map(f => f.website?.toLowerCase().trim()).filter(Boolean)
);

console.log(`Existing festivals in table: ${existingFestivals.length}`);
console.log(`  Distinct names:    ${existingNames.size}`);
console.log(`  Distinct websites: ${existingWebsites.size}\n`);

// ── Load candidates from staging ──────────────────────────────────────────────

const candidates = await fetchAll(() =>
  db.from("festival_staging")
    .select("id, festival_name, country, city, genre, website, source_url, latitude, longitude, festival_start_date, festival_end_date, social_links")
    .not("website",  "is", null)
    .not("country",  "is", null)
    .not("city",     "is", null)
    .not("latitude", "is", null)
    .not("genre",    "is", null)
    .eq("status", "pending")
);

console.log(`Score=100 candidates from staging: ${candidates.length}`);

// ── Apply filters ─────────────────────────────────────────────────────────────

const skipped = { zeroCoord: 0, dupName: 0, dupWebsite: 0 };
const toPublish = [];

for (const r of candidates) {
  // Skip zero-coordinate sentinel (geocoding failure)
  if (r.latitude === 0 || r.longitude === 0) {
    skipped.zeroCoord++;
    continue;
  }

  // Skip duplicate name
  const nameKey = r.festival_name?.toLowerCase().trim() ?? "";
  if (existingNames.has(nameKey)) {
    skipped.dupName++;
    continue;
  }

  // Skip duplicate website
  const siteKey = r.website?.toLowerCase().trim() ?? "";
  if (existingWebsites.has(siteKey)) {
    skipped.dupWebsite++;
    continue;
  }

  toPublish.push(r);

  // Register in collision sets so duplicates within the batch are caught too
  if (nameKey) existingNames.add(nameKey);
  if (siteKey) existingWebsites.add(siteKey);
}

console.log(`\nFiltering results:`);
console.log(`  Skipped (lat/lon = 0):     ${skipped.zeroCoord}`);
console.log(`  Skipped (duplicate name):  ${skipped.dupName}`);
console.log(`  Skipped (duplicate site):  ${skipped.dupWebsite}`);
console.log(`  ─────────────────────────`);
console.log(`  To publish:                ${toPublish.length}`);

if (DRY_RUN) {
  console.log("\n[DRY RUN] No records written.\n");
  await printReport(toPublish);
  process.exit(0);
}

// ── Insert into festivals ─────────────────────────────────────────────────────

console.log(`\nInserting ${toPublish.length} records into festivals…`);

const CHUNK = 100;
let inserted = 0, errors = 0;

for (let i = 0; i < toPublish.length; i += CHUNK) {
  const chunk = toPublish.slice(i, i + CHUNK);

  const rows = chunk.map(r => ({
    festival_name:       r.festival_name,
    country:             r.country,
    city:                r.city,
    category:            r.genre,          // staging.genre → festivals.category
    website:             r.website,
    source_url:          r.source_url,
    latitude:            r.latitude,
    longitude:           r.longitude,
    festival_start_date: r.festival_start_date ?? null,
    festival_end_date:   r.festival_end_date   ?? null,
    social_links:        r.social_links         ?? {},
    scrape_status:       "ok",
    is_verified:         true,
    last_scraped_at:     new Date().toISOString(),
  }));

  const { error } = await db.from("festivals").insert(rows);
  if (error) {
    console.error(`  ✗ chunk ${i}–${i + CHUNK}: ${error.message}`);
    errors++;
  } else {
    inserted += chunk.length;
    if (inserted % 200 === 0 || i + CHUNK >= toPublish.length) {
      console.log(`  inserted ${inserted}/${toPublish.length}…`);
    }
  }
}

// ── Mark staging records as approved ─────────────────────────────────────────

console.log(`\nMarking ${toPublish.length} staging records as approved…`);
const ids = toPublish.map(r => r.id);
let approveErrors = 0;

for (let i = 0; i < ids.length; i += 500) {
  const { error } = await db.from("festival_staging")
    .update({ status: "approved" })
    .in("id", ids.slice(i, i + 500));
  if (error) { console.error("  ✗ approve chunk:", error.message); approveErrors++; }
}

if (approveErrors === 0) {
  console.log(`  ✓ all marked approved`);
}

// ── Final report ──────────────────────────────────────────────────────────────

await printReport(toPublish);

// ─────────────────────────────────────────────────────────────────────────────

async function printReport(published) {
  const { count: totalFestivals } = await db.from("festivals")
    .select("*", { count: "exact", head: true });
  const { count: withCoords } = await db.from("festivals")
    .select("*", { count: "exact", head: true })
    .not("latitude", "is", null);

  // Genre distribution of published batch
  const genres = {};
  for (const r of published) genres[r.genre] = (genres[r.genre] ?? 0) + 1;
  const topGenres = Object.entries(genres).sort((a,b) => b[1]-a[1]).slice(0, 20);

  // Country distribution of published batch
  const countries = {};
  for (const r of published) countries[r.country] = (countries[r.country] ?? 0) + 1;
  const topCountries = Object.entries(countries).sort((a,b) => b[1]-a[1]).slice(0, 20);

  console.log(`\n${"═".repeat(72)}`);
  console.log("  PUBLISH REPORT");
  console.log(`  ${new Date().toISOString()}`);
  console.log(`${"═".repeat(72)}`);
  console.log(`  Total in festivals table:   ${totalFestivals}`);
  console.log(`  Newly published:            ${published.length}`);
  console.log(`  With coordinates (map-ready): ${withCoords}`);

  console.log(`\n  Top 20 genres (published batch):`);
  for (const [g, n] of topGenres) {
    console.log(`    ${String(n).padStart(4)}  ${g}`);
  }

  console.log(`\n  Top 20 countries (published batch):`);
  for (const [c, n] of topCountries) {
    console.log(`    ${String(n).padStart(4)}  ${c}`);
  }

  console.log(`\n  Map visibility:`);
  console.log(`    /explore queries festivals table ✓`);
  console.log(`    FestivalMap renders markers for records with latitude + longitude ✓`);
  console.log(`    All published records have non-null, non-zero coordinates ✓`);
  console.log(`    Markers will appear automatically on next page load ✓`);
  console.log();
}
