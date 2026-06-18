/**
 * UberFestival Scraper — entry point.
 *
 * Modes:
 *   node index.mjs                    # run all phases
 *   node index.mjs --mode=wikidata    # Wikidata bulk import only
 *   node index.mjs --mode=wikipedia   # Wikipedia list pages only
 *   node index.mjs --mode=discover    # festival directory crawl only
 *   node index.mjs --mode=update      # refresh dates on existing festivals
 *
 * Required environment variables:
 *   SUPABASE_URL              — your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (bypasses RLS)
 */

import { updateExisting }        from "./scrapers/update-existing.mjs";
import { discoverFromSources }   from "./scrapers/discover-sources.mjs";
import { fetchWikidataFestivals } from "./scrapers/wikidata-festivals.mjs";
import { fetchWikipediaFestivalList, WIKIPEDIA_FESTIVAL_LISTS } from "./scrapers/wikipedia-festivals.mjs";
import { validateFestival }      from "./lib/validate-festival.mjs";
import { geocode }               from "./lib/geocode.mjs";
import { db }                    from "./lib/supabase.mjs";

const mode = process.argv
  .find(a => a.startsWith("--mode="))
  ?.replace("--mode=", "") ?? "all";

const WIKIPEDIA_BATCH_DELAY = 2000;

console.log(`\n=== UberFestival Scraper — mode: ${mode} ===`);
console.log(`Started at ${new Date().toISOString()}\n`);

try {
  if (mode === "all" || mode === "wikidata") {
    console.log("── Phase 1: Wikidata bulk import ──");
    await runWikidataImport();
    console.log();
  }

  if (mode === "all" || mode === "wikipedia") {
    console.log("── Phase 2: Wikipedia list pages ──");
    await runWikipediaImport();
    console.log();
  }

  if (mode === "all" || mode === "discover") {
    console.log("── Phase 3: Festival directory crawl ──");
    await discoverFromSources();
    console.log();
  }

  if (mode === "all" || mode === "update") {
    console.log("── Phase 4: Refresh existing festival dates ──");
    await updateExisting();
    console.log();
  }

  console.log(`=== Done at ${new Date().toISOString()} ===\n`);
  process.exit(0);
} catch (err) {
  console.error("Fatal error:", err);
  process.exit(1);
}

// ── Wikidata import ───────────────────────────────────────────────────────────

async function runWikidataImport() {
  const festivals = await fetchWikidataFestivals();
  const knownWebsites = await loadKnownWebsites();
  let staged = 0;

  for (const festival of festivals) {
    const website = festival.official_website;

    if (website && knownWebsites.has(normaliseUrl(website))) continue;

    const { valid, reason } = validateFestival(festival);
    if (!valid) continue;

    let lat = festival.latitude;
    let lng = festival.longitude;

    // Geocode if Wikidata didn't have coordinates
    if ((lat == null || lng == null) && (festival.city || festival.country)) {
      const coords = await geocode(festival.city, festival.country);
      if (coords) { lat = coords.lat; lng = coords.lng; }
    }

    const { error } = await db.from("festival_staging").insert({
      festival_name:       festival.festival_name,
      country:             festival.country             ?? null,
      city:                festival.city                ?? null,
      genre:               festival.genre               ?? null,
      website:             website                      ?? null,
      latitude:            lat                          ?? null,
      longitude:           lng                          ?? null,
      festival_start_date: festival.festival_start_date ?? null,
      festival_end_date:   festival.festival_end_date   ?? null,
      source_url:          festival.source_url,
      status:              "pending",
    });

    if (error) {
      console.log(`  ✗ insert failed: "${festival.festival_name}" — ${error.message}`);
      continue;
    }

    if (website) knownWebsites.add(normaliseUrl(website));
    staged++;

    if (staged % 100 === 0) console.log(`  wikidata: ${staged} staged so far...`);
  }

  console.log(`  wikidata: ${staged} festivals staged`);
}

// ── Wikipedia import ──────────────────────────────────────────────────────────

async function runWikipediaImport() {
  const knownWebsites = await loadKnownWebsites();
  const knownNames    = await loadKnownNames();
  let totalStaged = 0;

  for (const source of WIKIPEDIA_FESTIVAL_LISTS) {
    const festivals = await fetchWikipediaFestivalList(source);

    for (const festival of festivals) {
      const nameLower = festival.festival_name.toLowerCase();
      if (knownNames.has(nameLower)) continue;

      const { valid, reason } = validateFestival(festival);
      if (!valid) continue;

      // Only geocode when we have a city — country-only returns a misleading centroid
      let lat = null, lng = null;
      if (festival.city) {
        const coords = await geocode(festival.city, festival.country);
        if (coords) { lat = coords.lat; lng = coords.lng; }
      }

      const { error } = await db.from("festival_staging").insert({
        festival_name:       festival.festival_name,
        country:             festival.country             ?? null,
        city:                festival.city                ?? null,
        genre:               festival.genre               ?? null,
        website:             festival.official_website    ?? null,
        latitude:            lat,
        longitude:           lng,
        festival_start_date: null,
        festival_end_date:   null,
        source_url:          festival.source_url,
        status:              "pending",
      });

      if (!error) {
        knownNames.add(nameLower);
        totalStaged++;
      }
    }

    await sleep(WIKIPEDIA_BATCH_DELAY);
  }

  console.log(`  wikipedia: ${totalStaged} festivals staged`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadKnownWebsites() {
  const set = new Set();
  const [a, b] = await Promise.all([
    db.from("festivals").select("website"),
    db.from("festival_staging").select("website"),
  ]);
  for (const r of [...(a.data ?? []), ...(b.data ?? [])]) {
    if (r.website) set.add(normaliseUrl(r.website));
  }
  return set;
}

async function loadKnownNames() {
  const set = new Set();
  const [a, b] = await Promise.all([
    db.from("festivals").select("festival_name"),
    db.from("festival_staging").select("festival_name"),
  ]);
  for (const r of [...(a.data ?? []), ...(b.data ?? [])]) {
    if (r.festival_name) set.add(r.festival_name.toLowerCase());
  }
  return set;
}

function normaliseUrl(url) {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return url.toLowerCase(); }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
