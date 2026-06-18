/**
 * Enrichment pipeline for festival_staging.
 *
 * Phases (run sequentially unless --phase=N is given):
 *
 *   A  Wikipedia infobox — fetch each festival's Wikipedia article,
 *      extract: website, city, country, genre, dates
 *
 *   B  Wikidata sitelinks — for Wikidata-sourced records, batch-resolve
 *      the English Wikipedia article URL, then apply phase A
 *
 *   C  Official website dates — for records that have a website but still
 *      lack festival dates, fetch the site and extract them
 *
 *   D  Geocoding — for records with city+country but no coordinates
 *
 * Usage:
 *   node --env-file=.env enrich.mjs             # run all phases
 *   node --env-file=.env enrich.mjs --phase=A   # Wikipedia only
 *   node --env-file=.env enrich.mjs --phase=B   # Wikidata sitelinks only
 *   node --env-file=.env enrich.mjs --phase=C   # Website dates only
 *   node --env-file=.env enrich.mjs --phase=D   # Geocoding only
 *   node --env-file=.env enrich.mjs --report    # completeness report only
 */

import { db }                         from "./lib/supabase.mjs";
import { fetchPage }                  from "./lib/fetch-page.mjs";
import { geocode }                    from "./lib/geocode.mjs";
import { extractDates }               from "./lib/extract-date.mjs";
import { extractWikipediaInfobox }    from "./lib/wikipedia-infobox.mjs";
import { batchGetWikipediaUrls, extractQid } from "./lib/wikidata-sitelinks.mjs";

const args       = process.argv.slice(2);
const phaseArg   = args.find(a => a.startsWith("--phase="))?.split("=")[1]?.toUpperCase();
const reportOnly = args.includes("--report");
const fromArg    = parseInt(args.find(a => a.startsWith("--from="))?.split("=")[1] ?? "0", 10);

const RUN_A = !phaseArg || phaseArg === "A";
const RUN_B = !phaseArg || phaseArg === "B";
const RUN_C = !phaseArg || phaseArg === "C";
const RUN_D = !phaseArg || phaseArg === "D";

const PAGE_SIZE    = 200;   // records fetched per DB query
const FETCH_DELAY  = 1100;  // ms between Wikipedia/website fetches
const BATCH_SIZE   = 4;     // concurrent fetches per wave

console.log(`\n${"═".repeat(72)}`);
console.log(`  UberFestival — Enrichment Pipeline`);
console.log(`  ${new Date().toISOString()}`);
console.log(`${"═".repeat(72)}\n`);

if (reportOnly) {
  await printReport();
  process.exit(0);
}

// ── Phase A: Wikipedia article infoboxes ─────────────────────────────────────

if (RUN_A) {
  console.log("── Phase A: Wikipedia article infoboxes ──");
  let offset = 0, total = 0;

  while (true) {
    const { data } = await db.from("festival_staging")
      .select("id, festival_name, website, city, country, genre, festival_start_date, festival_end_date, latitude, source_url")
      .like("source_url", "%en.wikipedia.org/wiki/%")
      .not("source_url", "like", "%List_of%")
      .range(offset, offset + PAGE_SIZE - 1);

    if (!data?.length) break;

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(r => enrichFromWikipedia(r, r.source_url))
      );
      total += results.filter(r => r.status === "fulfilled" && r.value).length;
      if (i + BATCH_SIZE < data.length) await sleep(FETCH_DELAY * BATCH_SIZE);
    }

    offset += PAGE_SIZE;
    if (data.length < PAGE_SIZE) break;
  }

  console.log(`  phase A: ${total} records updated\n`);
}

// ── Phase B: Wikidata sitelinks → Wikipedia infoboxes ────────────────────────

if (RUN_B) {
  const fromLabel = fromArg ? ` (from offset ${fromArg})` : "";
  console.log(`── Phase B: Wikidata sitelinks${fromLabel} ──`);
  let offset = fromArg, sitelinksResolved = 0, infoboxUpdated = 0;

  while (true) {
    const { data } = await db.from("festival_staging")
      .select("id, festival_name, website, city, country, genre, festival_start_date, festival_end_date, latitude, source_url")
      .like("source_url", "%wikidata.org/entity/Q%")
      .range(offset, offset + 999);

    if (!data?.length) break;

    // Batch-resolve Q-IDs → Wikipedia URLs
    const qids   = data.map(r => extractQid(r.source_url)).filter(Boolean);
    const urlMap = await batchGetWikipediaUrls(qids);
    sitelinksResolved += urlMap.size;

    console.log(`  batch offset=${offset}: ${data.length} records, ${urlMap.size} Wikipedia URLs found`);

    // Only iterate records that have a resolved Wikipedia URL — skip the rest
    // to avoid 4400ms sleeps for records with no article to fetch.
    const toEnrich = data.filter(r => {
      const qid = extractQid(r.source_url);
      return qid && urlMap.has(qid);
    });

    for (let i = 0; i < toEnrich.length; i += BATCH_SIZE) {
      const batch = toEnrich.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(r => {
          const wikiUrl = urlMap.get(extractQid(r.source_url));
          return enrichFromWikipedia(r, wikiUrl);
        })
      );
      infoboxUpdated += results.filter(r => r.status === "fulfilled" && r.value).length;
      if (i + BATCH_SIZE < toEnrich.length) await sleep(FETCH_DELAY * BATCH_SIZE);
    }

    offset += 1000;
    if (data.length < 1000) break;
  }

  console.log(`  phase B: ${sitelinksResolved} Wikipedia URLs resolved, ${infoboxUpdated} records updated\n`);
}

// ── Phase C: Official website — extract festival dates ───────────────────────

if (RUN_C) {
  console.log("── Phase C: Official website date extraction ──");
  let offset = 0, total = 0;

  while (true) {
    const { data } = await db.from("festival_staging")
      .select("id, festival_name, website, festival_start_date, festival_end_date, city, country, genre, latitude")
      .not("website", "is", null)
      .is("festival_start_date", null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (!data?.length) break;

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(enrichFromWebsite));
      total += results.filter(r => r.status === "fulfilled" && r.value).length;
      if (i + BATCH_SIZE < data.length) await sleep(FETCH_DELAY * BATCH_SIZE);
    }

    offset += PAGE_SIZE;
    if (data.length < PAGE_SIZE) break;
  }

  console.log(`  phase C: ${total} records updated with dates\n`);
}

// ── Phase D: Geocoding ────────────────────────────────────────────────────────

if (RUN_D) {
  console.log("── Phase D: Geocoding ──");
  let offset = 0, total = 0;

  while (true) {
    const { data } = await db.from("festival_staging")
      .select("id, festival_name, city, country, latitude")
      .not("city", "is", null)
      .is("latitude", null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (!data?.length) break;

    for (const record of data) {
      const coords = await geocode(record.city, record.country);
      if (coords) {
        await db.from("festival_staging").update({ latitude: coords.lat, longitude: coords.lng }).eq("id", record.id);
        total++;
      }
    }

    offset += PAGE_SIZE;
    if (data.length < PAGE_SIZE) break;
  }

  console.log(`  phase D: ${total} records geocoded\n`);
}

// ── Final report ──────────────────────────────────────────────────────────────

await printReport();

// ── Enrichment functions ──────────────────────────────────────────────────────

async function enrichFromWikipedia(record, articleUrl) {
  const { html } = await fetchPage(articleUrl);
  if (!html) return false;

  const infobox = extractWikipediaInfobox(html, articleUrl);
  const patch   = buildPatch(record, infobox);

  // After Wikipedia infobox, geocode if we now have city+country but no coords
  if ((patch.city || record.city) && (patch.country || record.country) && !record.latitude) {
    const coords = await geocode(patch.city ?? record.city, patch.country ?? record.country);
    if (coords) { patch.latitude = coords.lat; patch.longitude = coords.lng; }
  }

  if (!Object.keys(patch).length) return false;

  const { error } = await db.from("festival_staging").update(patch).eq("id", record.id);
  if (error) return false;

  const fields = Object.keys(patch).join(", ");
  console.log(`  ✓ [${record.id}] ${record.festival_name.slice(0, 40)} → ${fields}`);
  return true;
}

async function enrichFromWebsite(record) {
  const { html } = await fetchPage(record.website);
  if (!html) return false;

  const patch = {};

  // Try JSON-LD first
  const jsonLdDates = extractJsonLdDates(html);
  if (jsonLdDates.start) patch.festival_start_date = jsonLdDates.start;
  if (jsonLdDates.end)   patch.festival_end_date   = jsonLdDates.end;

  // Fall back to text patterns
  if (!patch.festival_start_date) {
    const bodyText = stripHtml(html);
    const dates = extractDates(bodyText);
    if (dates.festivalStart) patch.festival_start_date = dates.festivalStart;
    if (dates.festivalEnd)   patch.festival_end_date   = dates.festivalEnd;
  }

  // Also grab missing city/country/genre from structured data on the site
  const missing = {};
  if (!record.city    || !record.country) extractGeoFromHtml(html, missing);
  if (!record.genre)                      extractGenreFromHtml(html, missing);
  if (missing.city    && !record.city)    patch.city    = missing.city;
  if (missing.country && !record.country) patch.country = missing.country;
  if (missing.genre   && !record.genre)   patch.genre   = missing.genre;

  if (!Object.keys(patch).length) return false;

  const { error } = await db.from("festival_staging").update(patch).eq("id", record.id);
  if (error) return false;

  const fields = Object.keys(patch).join(", ");
  console.log(`  ✓ [${record.id}] ${record.festival_name.slice(0, 40)} → ${fields}`);
  return true;
}

// ── Helper: build update patch (only include fields that are missing) ─────────

function buildPatch(record, infobox) {
  const patch = {};
  if (!record.website              && infobox.website)              patch.website              = infobox.website;
  if (!record.city                 && infobox.city)                 patch.city                 = infobox.city;
  if (!record.country              && infobox.country)              patch.country              = infobox.country;
  if (!record.genre                && infobox.genre)                patch.genre                = infobox.genre;
  if (!record.festival_start_date  && infobox.festival_start_date)  patch.festival_start_date  = infobox.festival_start_date;
  if (!record.festival_end_date    && infobox.festival_end_date)    patch.festival_end_date    = infobox.festival_end_date;
  return patch;
}

// ── Helper: JSON-LD date extraction ──────────────────────────────────────────

function extractJsonLdDates(html) {
  const result = {};
  const scripts = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const s of scripts) {
    try {
      let data = JSON.parse(s.replace(/<script[^>]*>|<\/script>/gi, ""));
      if (Array.isArray(data)) data = data[0];
      if (!data) continue;
      const type = String(data["@type"] ?? "");
      if (!/Event|Festival|MusicEvent/i.test(type)) continue;
      if (data.startDate) result.start = String(data.startDate).slice(0, 10);
      if (data.endDate)   result.end   = String(data.endDate).slice(0, 10);
    } catch { /* ignore */ }
  }
  return result;
}

// ── Helper: geo from HTML structured data ────────────────────────────────────

const ISO2 = {
  GB:"United Kingdom", US:"United States", FR:"France", DE:"Germany",
  NL:"Netherlands", BE:"Belgium", SE:"Sweden", NO:"Norway", DK:"Denmark",
  FI:"Finland", CH:"Switzerland", ES:"Spain", PT:"Portugal", IT:"Italy",
  AU:"Australia", CA:"Canada", BR:"Brazil", JP:"Japan", NZ:"New Zealand",
};

function extractGeoFromHtml(html, out) {
  const region = html.match(/<meta[^>]+name="geo\.region"[^>]+content="([^"]+)"/i)?.[1];
  if (region) {
    const code = region.split("-")[0].toUpperCase();
    if (ISO2[code]) out.country = ISO2[code];
  }
  const itempropCountry = html.match(/itemprop="addressCountry"[^>]*content="([^"]+)"/i)?.[1];
  if (itempropCountry) out.country = itempropCountry.trim();
  const itempropCity = html.match(/itemprop="addressLocality"[^>]*content="([^"]+)"/i)?.[1];
  if (itempropCity) out.city = itempropCity.trim();
}

function extractGenreFromHtml(html, out) {
  const GENRES = ["jazz","electronic","classical","folk","rock","pop","hip-hop","blues",
                  "country","metal","indie","reggae","soul","dance","techno","house","punk","world music"];
  const bodyText = html.replace(/<[^>]+>/g, " ").toLowerCase().slice(0, 3000);
  for (const g of GENRES) {
    if (bodyText.includes(g)) { out.genre = g.charAt(0).toUpperCase() + g.slice(1); return; }
  }
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ── Report ────────────────────────────────────────────────────────────────────

async function printReport() {
  const checks = [
    ["Total festivals",        db.from("festival_staging").select("*",{count:"exact",head:true})],
    ["Has website",            db.from("festival_staging").select("*",{count:"exact",head:true}).not("website","is",null)],
    ["Has city",               db.from("festival_staging").select("*",{count:"exact",head:true}).not("city","is",null)],
    ["Has country",            db.from("festival_staging").select("*",{count:"exact",head:true}).not("country","is",null)],
    ["Has coordinates",        db.from("festival_staging").select("*",{count:"exact",head:true}).not("latitude","is",null)],
    ["Has genre",              db.from("festival_staging").select("*",{count:"exact",head:true}).not("genre","is",null)],
    ["Has start date",         db.from("festival_staging").select("*",{count:"exact",head:true}).not("festival_start_date","is",null)],
    ["Has end date",           db.from("festival_staging").select("*",{count:"exact",head:true}).not("festival_end_date","is",null)],
    ["100% complete",          db.from("festival_staging").select("*",{count:"exact",head:true})
                                 .not("website","is",null).not("city","is",null).not("country","is",null)
                                 .not("latitude","is",null).not("genre","is",null).not("festival_start_date","is",null)],
  ];

  const results = await Promise.all(checks.map(([l, q]) => q.then(r => [l, r.count ?? 0])));
  const total   = results[0][1];

  console.log(`${"═".repeat(72)}`);
  console.log("  COMPLETENESS REPORT");
  console.log(`  ${new Date().toISOString()}`);
  console.log(`${"═".repeat(72)}`);
  for (const [label, count] of results) {
    const pct = total ? ` (${Math.round(count / total * 100)}%)` : "";
    console.log(`  ${String(count).padStart(6)}${pct.padEnd(8)}  ${label}`);
  }
  console.log();
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
