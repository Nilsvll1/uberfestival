/**
 * discover-sources.mjs
 *
 * Discovers new festivals from two source types stored in scrape_sources:
 *
 *   source_type = 'wikipedia_list'
 *     → Parse the wikitable on the Wikipedia list page directly.
 *       Returns name + location + genre. Website needs a follow-up fetch.
 *
 *   source_type = 'directory'
 *     → Crawl the listing page, follow links to individual festival pages,
 *       extract festival data from each page.
 *
 * Every festival is validated (must be a real festival event), geocoded if
 * coordinates are missing, then staged to festival_staging.
 */

import * as cheerio from "cheerio";
import { db }                        from "../lib/supabase.mjs";
import { fetchPage }                 from "../lib/fetch-page.mjs";
import { validateFestival }          from "../lib/validate-festival.mjs";
import { geocode }                   from "../lib/geocode.mjs";
import { fetchWikipediaFestivalList } from "./wikipedia-festivals.mjs";
import { extractFestivalFromPage }   from "./extract-from-page.mjs";

const BATCH_SIZE    = 4;
const BATCH_DELAY   = 1500;

export async function discoverFromSources() {
  const { data: sources, error } = await db
    .from("scrape_sources")
    .select("id, name, url, source_type")
    .eq("is_active", true)
    .order("last_scraped_at", { ascending: true, nullsFirst: true });

  if (error) throw new Error(`Failed to load sources: ${error.message}`);
  if (!sources?.length) { console.log("discover: no active sources."); return; }

  const knownWebsites = await loadKnownWebsites();
  let totalStaged = 0;

  for (const source of sources) {
    console.log(`\ndiscover: [${source.source_type}] ${source.name}`);
    console.log(`          ${source.url}`);

    let staged = 0;

    if (source.source_type === "wikipedia_list") {
      staged = await processWikipediaList(source, knownWebsites);
    } else {
      staged = await processDirectory(source, knownWebsites);
    }

    totalStaged += staged;

    await db.from("scrape_sources").update({
      last_scraped_at: new Date().toISOString(),
      festivals_found: staged,
    }).eq("id", source.id);
  }

  console.log(`\ndiscover: done — ${totalStaged} total staged`);
}

// ── Wikipedia list source ─────────────────────────────────────────────────────

async function processWikipediaList(source, knownWebsites) {
  const festivals = await fetchWikipediaFestivalList(source);
  let staged = 0;

  for (let i = 0; i < festivals.length; i += BATCH_SIZE) {
    const batch = festivals.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(f => stageRecord(f, knownWebsites)));
    staged += results.filter(Boolean).length;
    if (i + BATCH_SIZE < festivals.length) await sleep(BATCH_DELAY);
  }

  return staged;
}

// ── Directory source ──────────────────────────────────────────────────────────

const FESTIVAL_LINK_KEYWORDS = [
  "festival", "fest ", "fête", "feria", "foire", "fiesta",
  "musik", "musique", "musica", "musik",
];

const SKIP_HREF_RE = [
  /\/(about|contact|privacy|terms|faq|login|signup|register|search|tag|category|page\/\d)/i,
  /^(mailto|tel|javascript):/i,
  /#$/,
];

async function processDirectory(source, knownWebsites) {
  const { html, error } = await fetchPage(source.url);
  if (!html) { console.log(`  ✗ fetch failed: ${error}`); return 0; }

  const links = extractFestivalLinks(html, source.url);
  console.log(`  → ${links.length} festival links found`);

  let staged = 0;

  for (let i = 0; i < links.length; i += BATCH_SIZE) {
    const batch = links.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(url => processFestivalPage(url, knownWebsites))
    );
    staged += results.filter(Boolean).length;
    if (i + BATCH_SIZE < links.length) await sleep(BATCH_DELAY);
  }

  return staged;
}

function extractFestivalLinks(html, sourceUrl) {
  const $ = cheerio.load(html);
  const base = new URL(sourceUrl);
  const seen = new Set();
  const links = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const text = $(el).text().toLowerCase();

    if (SKIP_HREF_RE.some(re => re.test(href))) return;

    const lowerHref = href.toLowerCase();
    const hasFestivalSignal = FESTIVAL_LINK_KEYWORDS.some(
      kw => text.includes(kw) || lowerHref.includes(kw)
    );
    if (!hasFestivalSignal) return;

    try {
      const abs = new URL(href, base).href;
      if (!seen.has(abs)) { seen.add(abs); links.push(abs); }
    } catch { /* ignore */ }
  });

  return links.slice(0, 60);
}

async function processFestivalPage(url, knownWebsites) {
  const { html, error } = await fetchPage(url);
  if (!html) { console.log(`  ✗ fetch failed: ${url} — ${error}`); return false; }

  const festival = extractFestivalFromPage(html, url);
  return stageRecord(festival, knownWebsites);
}

// ── Staging ───────────────────────────────────────────────────────────────────

async function stageRecord(festival, knownWebsites) {
  const website = festival.official_website || festival.website || null;

  // Skip if we already have this festival
  if (website && knownWebsites.has(normaliseUrl(website))) {
    return false;
  }

  // Validate: must be a real festival
  const { valid, reason } = validateFestival(festival);
  if (!valid) {
    console.log(`  ✗ rejected: "${festival.festival_name}" — ${reason}`);
    return false;
  }

  // Geocode if missing coordinates
  let lat = festival.latitude ?? null;
  let lng = festival.longitude ?? null;

  if ((lat == null || lng == null) && (festival.city || festival.country)) {
    const coords = await geocode(festival.city, festival.country);
    if (coords) { lat = coords.lat; lng = coords.lng; }
  }

  const { error: insertError } = await db.from("festival_staging").insert({
    festival_name:       festival.festival_name,
    country:             festival.country       ?? null,
    city:                festival.city          ?? null,
    genre:               festival.genre         ?? null,
    website:             website,
    latitude:            lat,
    longitude:           lng,
    festival_start_date: festival.festival_start_date ?? null,
    festival_end_date:   festival.festival_end_date   ?? null,
    source_url:          festival.source_url,
    status:              "pending",
  });

  if (insertError) {
    console.log(`  ✗ insert failed: "${festival.festival_name}" — ${insertError.message}`);
    return false;
  }

  if (website) knownWebsites.add(normaliseUrl(website));

  const geoStr = [festival.city, festival.country].filter(Boolean).join(", ") || "no geo";
  const coordStr = lat != null ? ` [${lat.toFixed(3)}, ${lng.toFixed(3)}]` : "";
  console.log(`  + staged: "${festival.festival_name}" | ${geoStr}${coordStr}`);
  return true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadKnownWebsites() {
  const set = new Set();
  const [fRes, sRes] = await Promise.all([
    db.from("festivals").select("website"),
    db.from("festival_staging").select("website"),
  ]);
  for (const r of [...(fRes.data ?? []), ...(sRes.data ?? [])]) {
    if (r.website) set.add(normaliseUrl(r.website));
  }
  return set;
}

function normaliseUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch { return url.toLowerCase(); }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
