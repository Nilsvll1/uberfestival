/**
 * Enricher — Phase B of the ingestion pipeline.
 *
 * Takes a batch of extracted festival candidates and enriches each one with:
 *   1. Geocoding  — resolves city + country → lat/lng via Nominatim
 *   2. URL probe  — HEAD request on application_url to verify it is live
 *
 * Both operations are best-effort: a failure leaves the record unchanged
 * (it will just score lower in Phase C).
 *
 * Rate limits:
 *   Nominatim ToS: 1 req/sec — enforced inside geocode.mjs.
 *   URL probing:   HEAD requests with a 4s timeout; no additional delay needed.
 */

import { geocode } from "../lib/geocode.mjs";

const URL_PROBE_TIMEOUT_MS = 4_000;
const USER_AGENT = "Mozilla/5.0 (compatible; UberFestivalBot/1.0; +https://uberfestival.com)";

/**
 * Enriches a batch of candidate records in-place.
 *
 * Adds these fields to each record:
 *   latitude            — number|null
 *   longitude           — number|null
 *   _geocoded           — boolean (true = Nominatim succeeded)
 *   _url_live           — boolean (true = HEAD application_url returned 2xx/3xx)
 *
 * @param {object[]} candidates
 * @param {{ log: Function }} reporter   — reporter.log(null, level, type, msg, data)
 * @returns {Promise<object[]>}          — same array, mutated
 */
export async function enrichBatch(candidates, reporter) {
  const total = candidates.length;
  if (!total) return candidates;

  console.log(`\n── Phase B: Enrichment (${total} candidate${total === 1 ? "" : "s"})`);

  let geocodedCount = 0;
  let urlLiveCount  = 0;

  // ── Step 1: Geocode all candidates with a city or country ──────────────────
  // Nominatim rate-limits itself inside geocode.mjs (1100ms between requests).
  // We do them sequentially so the built-in rate-limiter stays correct.
  const needsGeo = candidates.filter((c) => (c.city || c.country) && !c.latitude);

  if (needsGeo.length) {
    console.log(`  Geocoding ${needsGeo.length} candidate(s) via Nominatim…`);
    for (const candidate of needsGeo) {
      try {
        const coords = await geocode(candidate.city, candidate.country);
        if (coords) {
          candidate.latitude  = coords.lat;
          candidate.longitude = coords.lng;
          candidate._geocoded = true;
          geocodedCount++;
        } else {
          candidate._geocoded = false;
        }
      } catch {
        candidate._geocoded = false;
      }
    }
  }

  // Mark candidates that already had coordinates or couldn't be geocoded
  for (const c of candidates) {
    if (c._geocoded === undefined) {
      c._geocoded = !!(c.latitude && c.longitude);
    }
  }

  // ── Step 2: Probe application URLs (parallel, capped at 8 concurrent) ──────
  const needsProbe = candidates.filter((c) => c.application_url);

  if (needsProbe.length) {
    console.log(`  Probing ${needsProbe.length} application URL(s)…`);
    const CONCURRENCY = 8;
    for (let i = 0; i < needsProbe.length; i += CONCURRENCY) {
      const batch = needsProbe.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (candidate) => {
        try {
          const res = await fetch(candidate.application_url, {
            method:   "HEAD",
            headers:  { "User-Agent": USER_AGENT },
            redirect: "follow",
            signal:   AbortSignal.timeout(URL_PROBE_TIMEOUT_MS),
          });
          candidate._url_live = res.ok;
          if (res.ok) urlLiveCount++;
        } catch {
          candidate._url_live = false;
        }
      }));
    }
  }

  // Candidates without an application_url default to false
  for (const c of candidates) {
    if (c._url_live === undefined) c._url_live = false;
  }

  console.log(`  Geocoded: ${geocodedCount}/${needsGeo.length}  |  URLs live: ${urlLiveCount}/${needsProbe.length}`);

  return candidates;
}

/**
 * Re-scores a record after enrichment.
 *
 * Adds bonus points on top of the base confidence from Phase A:
 *   +0.10  geocoding succeeded  (proves the location is real)
 *   +0.05  application_url HEAD returned 2xx  (proves the link works)
 *
 * Capped at 1.0.
 *
 * @param {object} record       — enriched candidate (has _geocoded, _url_live)
 * @param {number} baseScore    — scoreConfidence() result from Phase A
 * @returns {number}            — final confidence, 0–1
 */
export function rescoreAfterEnrichment(record, baseScore) {
  let score = baseScore;
  if (record._geocoded)  score += 0.10;
  if (record._url_live)  score += 0.05;
  return Math.min(1, score);
}
