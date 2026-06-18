/**
 * Data quality cleaning pipeline for festival_staging.
 *
 * Steps (all idempotent — safe to re-run):
 *   1. Delete non-festival records (grants, awards, opportunities, news)
 *   2. Remove name duplicates (keep highest-quality record per name)
 *   3. Remove exact-website duplicates
 *   4. Normalize city values (strip admin suffixes, null garbage strings)
 *   5. Normalize country values (fix historical / junk values)
 *   6. Quality report (score distribution + completeness table)
 *
 * Usage:
 *   node --env-file=.env clean.mjs            # run all steps + report
 *   node --env-file=.env clean.mjs --dry-run  # preview only, no writes
 *   node --env-file=.env clean.mjs --report   # report only
 */

import { db } from "./lib/supabase.mjs";

const args    = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const REPORT  = args.includes("--report");

console.log(`\n${"═".repeat(72)}`);
console.log(`  UberFestival — Data Quality Cleaner${DRY_RUN ? "  [DRY RUN]" : ""}`);
console.log(`  ${new Date().toISOString()}`);
console.log(`${"═".repeat(72)}\n`);

// ── Pagination helper ─────────────────────────────────────────────────────────

async function fetchAll(buildQuery) {
  const PAGE = 1000;
  let all = [], offset = 0;
  while (true) {
    const { data, error } = await buildQuery().range(offset, offset + PAGE - 1);
    if (error) throw new Error("fetchAll: " + error.message);
    if (!data?.length) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

// ── Reject patterns (non-festival name detection) ────────────────────────────

const REJECT_NAME_RE = [
  /\b(grant|bursary|stipend|grantee|grantees)\b/i,
  /\b(award|prize|honour|honor)\b/i,
  /\b(competition|contest|battle of the bands)\b/i,
  /\b(fellowship|scholarship|mentorship|mentoring)\b/i,
  /\b(residency|artist.in.residence)\b/i,
  /\b(open call|call for (entries|submissions|artists|proposals|applications))\b/i,
  /\b(apply (now|today|here)|application (form|portal|deadline)|applications? open)\b/i,
  /\b(conference|summit|symposium|forum|panel|roundtable)\b/i,
  /\b(workshop|masterclass|seminar|lecture|tutorial)\b/i,
  /\b(funding|invest|finance|support programme)\b/i,
  /\b(press release|announcement|news update|blog post)\b/i,
  /\b(deadline|deadlines)\b/i,
  /^(resources?|directory|listing|about us?|contact us?|faq|help|home|opportunities?)\b/i,
  /^(latest|current|upcoming) (opportunities|events|news)\b/i,
  /^how to /i,
  /^top \d+ /i,
  /^(the )?(complete|ultimate|definitive) guide/i,
  /\bsubmissions?\b/i,
  /announcing (over|the first)/i,
  /showcase (guide|artists?)\b/i,
  /\btrade mission\b/i,
  /\bcatalys(er|t) fund/i,
  /\bvigtige\b/i,    // Danish for "important" — the mxd.dk non-festival page
];

function isNonFestival(name) {
  return REJECT_NAME_RE.some(re => re.test(name ?? ""));
}

// ── City normalization ────────────────────────────────────────────────────────

const CITY_ADMIN_SUFFIX = /\s+(municipality|rural municipality|regional municipality|district|province|prefecture|region|metropolitan area)\s*$/i;

const GARBAGE_CITY_RE = /please|contact|material|information|online|campground|pickin place|press release|located within|undeveloped land|mw-parser|venues?\s*\./i;

function normalizeCity(city) {
  if (!city) return null;
  let c = city.trim();
  // Null out garbage strings
  if (GARBAGE_CITY_RE.test(c) || c.length > 60) return null;
  // Strip admin suffixes
  c = c.replace(CITY_ADMIN_SUFFIX, "").trim();
  return c || null;
}

// ── Country normalization ─────────────────────────────────────────────────────

const COUNTRY_MAP = {
  "German Democratic Republic":                    "Germany",
  "Kingdom of Great Britain":                      "United Kingdom",
  "United Kingdom of Great Britain and Ireland":   "United Kingdom",
  "Across the UK":                                 "United Kingdom",
  "Graz and Styria":                               "Austria",
  "Indian Institute of Management Bangalore":      "India",
  "People's Republic of China":                    "China",
  "Rome":                                          null,   // city not country; nulled — record should have Italy
  "Worldwide":                                     null,
  "Midlands":                                      null,
  "Maram Centre":                                  null,
  "including press releases":                      null,
  "please contact online":                         null,
  "please contact steg":                           null,
};

const GARBAGE_COUNTRY_RE = /please|contact|material|information|steg|campground|mw-parser|press release/i;

function normalizeCountry(country) {
  if (!country) return null;
  const c = country.trim();
  if (c in COUNTRY_MAP) return COUNTRY_MAP[c];    // explicit map (may return null)
  if (GARBAGE_COUNTRY_RE.test(c) || c.length > 60) return null;
  return c;
}

// ── Quality scoring (0–100) ───────────────────────────────────────────────────

function qualityScore(r) {
  let score = 0;
  if (r.website)   score += 20;
  if (r.country)   score += 20;
  if (r.city)      score += 20;
  if (r.latitude)  score += 20;
  if (r.genre)     score += 20;
  return score;
}

// ─────────────────────────────────────────────────────────────────────────────

if (REPORT) { await printReport(); process.exit(0); }

// ── Step 1: Delete non-festival records ──────────────────────────────────────

console.log("── Step 1: Delete non-festival records ──");
const allRecords = await fetchAll(() =>
  db.from("festival_staging")
    .select("id, festival_name, website, city, country, genre, latitude, longitude, source_url")
);
console.log(`  Loaded ${allRecords.length} total records`);

const toDelete = allRecords.filter(r => isNonFestival(r.festival_name));
console.log(`  Found ${toDelete.length} non-festival records:`);
for (const r of toDelete) {
  console.log(`    [${r.id}] ${r.festival_name?.slice(0, 60)}`);
}

if (!DRY_RUN && toDelete.length) {
  const ids = toDelete.map(r => r.id);
  const { error } = await db.from("festival_staging").delete().in("id", ids);
  if (error) console.error("  ✗ delete error:", error.message);
  else console.log(`  ✓ deleted ${ids.length} records`);
}

// Remove deleted records from working set
const remaining = allRecords.filter(r => !toDelete.find(d => d.id === r.id));

// ── Step 2: Remove name duplicates ───────────────────────────────────────────

console.log("\n── Step 2: Remove name duplicates ──");

const nameGroups = {};
for (const r of remaining) {
  const key = (r.festival_name ?? "").toLowerCase().trim();
  if (!nameGroups[key]) nameGroups[key] = [];
  nameGroups[key].push(r);
}

const dupNameGroups = Object.entries(nameGroups).filter(([, g]) => g.length > 1);
console.log(`  Found ${dupNameGroups.length} duplicate name groups`);

const nameDupToDelete = [];
for (const [name, group] of dupNameGroups) {
  // Sort: highest completeness first, then prefer wikidata > wikipedia > other
  group.sort((a, b) => {
    const sa = qualityScore(a), sb = qualityScore(b);
    if (sb !== sa) return sb - sa;
    const srcRank = s =>
      s?.includes("wikidata.org") ? 2 :
      s?.includes("wikipedia.org") ? 1 : 0;
    return srcRank(b.source_url) - srcRank(a.source_url);
  });
  const [keep, ...dupes] = group;
  for (const d of dupes) nameDupToDelete.push(d);
  if (dupes.length) {
    console.log(`  keep [${keep.id}] "${name.slice(0, 40)}" — drop ${dupes.map(d => d.id).join(", ")}`);
  }
}

if (!DRY_RUN && nameDupToDelete.length) {
  const ids = nameDupToDelete.map(r => r.id);
  const CHUNK = 200;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { error } = await db.from("festival_staging").delete().in("id", ids.slice(i, i + CHUNK));
    if (!error) deleted += Math.min(CHUNK, ids.length - i);
  }
  console.log(`  ✓ deleted ${deleted} duplicate-name records`);
}

const afterNameDedup = remaining.filter(r => !nameDupToDelete.find(d => d.id === r.id));

// ── Step 3: Remove website duplicates (exact URL) ────────────────────────────

console.log("\n── Step 3: Remove website duplicates ──");

const siteGroups = {};
for (const r of afterNameDedup) {
  if (!r.website) continue;
  const key = r.website.toLowerCase().trim();
  if (!siteGroups[key]) siteGroups[key] = [];
  siteGroups[key].push(r);
}

const dupSiteGroups = Object.entries(siteGroups).filter(([, g]) => g.length > 1);
console.log(`  Found ${dupSiteGroups.length} duplicate exact-website groups`);

const siteDupToDelete = [];
for (const [url, group] of dupSiteGroups) {
  group.sort((a, b) => qualityScore(b) - qualityScore(a));
  const [keep, ...dupes] = group;
  for (const d of dupes) siteDupToDelete.push(d);
  console.log(`  keep [${keep.id}] "${keep.festival_name?.slice(0,35)}" — drop ${dupes.map(d=>d.id).join(", ")} (${url.slice(0,50)})`);
}

if (!DRY_RUN && siteDupToDelete.length) {
  const ids = siteDupToDelete.map(r => r.id);
  const { error } = await db.from("festival_staging").delete().in("id", ids);
  if (!error) console.log(`  ✓ deleted ${ids.length} duplicate-website records`);
  else console.error("  ✗", error.message);
}

// ── Step 4: Normalize city values ────────────────────────────────────────────

console.log("\n── Step 4: Normalize city values ──");

const cityPatches = [];
const afterSiteDedup = afterNameDedup.filter(r => !siteDupToDelete.find(d => d.id === r.id));

for (const r of afterSiteDedup) {
  const fixed = normalizeCity(r.city);
  if (fixed !== r.city) {
    cityPatches.push({ id: r.id, old: r.city, city: fixed });
  }
}

console.log(`  ${cityPatches.length} city values to fix`);
for (const p of cityPatches.slice(0, 30)) {
  console.log(`    [${p.id}] "${p.old?.slice(0,35)}" → "${p.city ?? "NULL"}"`);
}
if (cityPatches.length > 30) console.log(`    … and ${cityPatches.length - 30} more`);

if (!DRY_RUN && cityPatches.length) {
  const CHUNK = 50;
  let updated = 0;
  for (let i = 0; i < cityPatches.length; i += CHUNK) {
    for (const p of cityPatches.slice(i, i + CHUNK)) {
      const { error } = await db.from("festival_staging").update({ city: p.city }).eq("id", p.id);
      if (!error) updated++;
    }
  }
  console.log(`  ✓ updated ${updated} city values`);
}

// ── Step 5: Normalize country values ─────────────────────────────────────────

console.log("\n── Step 5: Normalize country values ──");

const countryPatches = [];
for (const r of afterSiteDedup) {
  const fixed = normalizeCountry(r.country);
  if (fixed !== r.country) {
    countryPatches.push({ id: r.id, old: r.country, country: fixed });
  }
}

console.log(`  ${countryPatches.length} country values to fix`);
for (const p of countryPatches) {
  console.log(`    [${p.id}] "${p.old?.slice(0, 45)}" → "${p.country ?? "NULL"}"`);
}

if (!DRY_RUN && countryPatches.length) {
  let updated = 0;
  for (const p of countryPatches) {
    const { error } = await db.from("festival_staging").update({ country: p.country }).eq("id", p.id);
    if (!error) updated++;
  }
  console.log(`  ✓ updated ${updated} country values`);
}

// ── Final report ──────────────────────────────────────────────────────────────

await printReport();

// ─────────────────────────────────────────────────────────────────────────────

async function printReport() {
  // Fetch fresh counts from DB
  const checks = [
    ["Total festivals",     db.from("festival_staging").select("*", { count: "exact", head: true })],
    ["Has website",         db.from("festival_staging").select("*", { count: "exact", head: true }).not("website", "is", null)],
    ["Has city",            db.from("festival_staging").select("*", { count: "exact", head: true }).not("city", "is", null)],
    ["Has country",         db.from("festival_staging").select("*", { count: "exact", head: true }).not("country", "is", null)],
    ["Has coordinates",     db.from("festival_staging").select("*", { count: "exact", head: true }).not("latitude", "is", null)],
    ["Has genre",           db.from("festival_staging").select("*", { count: "exact", head: true }).not("genre", "is", null)],
    ["Score = 100",         db.from("festival_staging").select("*", { count: "exact", head: true })
                              .not("website","is",null).not("city","is",null).not("country","is",null)
                              .not("latitude","is",null).not("genre","is",null)],
    ["Score ≥ 80",          db.from("festival_staging").select("*", { count: "exact", head: true })
                              .or("website.not.is.null,city.not.is.null,country.not.is.null,latitude.not.is.null")],
  ];

  const results = await Promise.all(checks.map(([l, q]) => q.then(r => [l, r.count ?? 0])));
  const total   = results[0][1];

  // Quality score distribution — compute from a fresh full fetch
  const allFresh = await fetchAll(() =>
    db.from("festival_staging")
      .select("website, city, country, latitude, genre")
  );

  const scoreDist = { 0: 0, 20: 0, 40: 0, 60: 0, 80: 0, 100: 0 };
  for (const r of allFresh) {
    const s = qualityScore(r);
    scoreDist[s] = (scoreDist[s] ?? 0) + 1;
  }

  console.log(`\n${"═".repeat(72)}`);
  console.log("  QUALITY REPORT");
  console.log(`  ${new Date().toISOString()}`);
  console.log(`${"═".repeat(72)}`);
  for (const [label, count] of results) {
    const pct = total ? ` (${Math.round(count / total * 100)}%)` : "";
    console.log(`  ${String(count).padStart(6)}${pct.padEnd(8)}  ${label}`);
  }
  console.log(`\n  Quality score distribution:`);
  for (const [score, count] of Object.entries(scoreDist).sort((a,b) => Number(b[0])-Number(a[0]))) {
    const bar = "█".repeat(Math.round(count / total * 40));
    console.log(`    ${String(score).padStart(3)}/100  ${String(count).padStart(5)}  ${bar}`);
  }
  console.log();
}
