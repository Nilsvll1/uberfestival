/**
 * Fetches music festivals from Wikidata via SPARQL.
 *
 * Returns up to 5000 festivals with: name, country, city, coordinates,
 * official website, and genre. Dates are not in Wikidata per-edition so
 * they come back null and must be supplemented from official sites.
 *
 * Wikidata types included:
 *   Q170238  = music festival
 *   Q1539118 = outdoor music festival
 *   Q4438121 = annual music festival
 */

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";

// Q868557  = music festival  (direct label-verified 2026-06-15)
// Q1154859 = rock festival   (subtype of Q868557)
// Q5110343 = Christian music festival (subtype)
// Q670265  = eisteddfod (competitive music/poetry festival)
// Q5326884 = early music festival (subtype)
// Q5001982 = buskers festival (subtype)
const QUERY = `
SELECT DISTINCT ?festival ?name ?countryLabel ?cityLabel ?coords ?website ?genreLabel WHERE {
  VALUES ?ftype { wd:Q868557 wd:Q1154859 wd:Q5110343 wd:Q670265 wd:Q5326884 wd:Q5001982 }
  ?festival wdt:P31 ?ftype .
  ?festival rdfs:label ?name FILTER (LANG(?name) = "en") .
  OPTIONAL { ?festival wdt:P17 ?country . }
  OPTIONAL { ?festival wdt:P131 ?city . }
  OPTIONAL { ?festival wdt:P625 ?coords . }
  OPTIONAL { ?festival wdt:P856 ?website . }
  OPTIONAL { ?festival wdt:P136 ?genre . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT 6000
`;

export async function fetchWikidataFestivals() {
  console.log("wikidata: running SPARQL query...");

  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(QUERY)}&format=json`;

  const res = await fetch(url, {
    headers: {
      "Accept": "application/sparql-results+json",
      "User-Agent": "UberFestivalBot/1.0 (https://uberfestival.com; music-festival-database)",
    },
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) throw new Error(`Wikidata SPARQL failed: HTTP ${res.status}`);

  const data = await res.json();
  const bindings = data.results.bindings;
  console.log(`wikidata: ${bindings.length} raw results`);

  const seen = new Set();
  const festivals = [];

  for (const b of bindings) {
    const name = b.name?.value?.trim();
    if (!name) continue;

    // Deduplicate by normalised name
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const country = filterQid(b.countryLabel?.value) ?? null;
    const city    = filterQid(b.cityLabel?.value)    ?? null;
    const website = b.website?.value ?? null;
    const genre   = normaliseGenre(filterQid(b.genreLabel?.value));
    const coords  = parseWkt(b.coords?.value);
    const wikidataUrl = b.festival?.value ?? null;

    festivals.push({
      festival_name:       name,
      country,
      city,
      latitude:            coords?.lat    ?? null,
      longitude:           coords?.lng    ?? null,
      official_website:    website,
      festival_start_date: null,
      festival_end_date:   null,
      genre,
      source_url:          wikidataUrl ?? "https://query.wikidata.org/",
      source:              "wikidata",
    });
  }

  console.log(`wikidata: ${festivals.length} deduplicated festivals`);
  return festivals;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const GEO_BLOCKLIST = new Set(["worldwide", "global", "international", "various", "online"]);

function filterQid(value) {
  if (!value) return null;
  const v = value.trim();
  if (!v || /^Q\d+$/.test(v)) return null;
  if (GEO_BLOCKLIST.has(v.toLowerCase())) return null;
  return v;
}

function parseWkt(wkt) {
  if (!wkt) return null;
  // WKT format from Wikidata: "Point(lon lat)"
  const m = wkt.match(/Point\(\s*([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\s*\)/);
  if (!m) return null;
  return { lat: parseFloat(m[2]), lng: parseFloat(m[1]) };
}

function normaliseGenre(genre) {
  if (!genre) return null;
  return genre
    .replace(/ music$/i, "")
    .replace(/^contemporary /i, "")
    .replace(/^modern /i, "")
    .replace(/^traditional /i, "")
    .trim() || null;
}
