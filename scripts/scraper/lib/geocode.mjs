/**
 * Nominatim geocoder (OpenStreetMap).
 * Rate-limited to 1 req/sec per ToS. Results are cached in-process.
 */

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const UA = "UberFestivalBot/1.0 (https://uberfestival.com; music-festival-database)";

const cache = new Map();
let lastCallMs = 0;

/**
 * @param {string|null} city
 * @param {string|null} country
 * @returns {Promise<{ lat: number, lng: number }|null>}
 */
export async function geocode(city, country) {
  const q = [city, country].filter(Boolean).join(", ");
  if (!q) return null;

  const key = q.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const wait = Math.max(0, 1100 - (Date.now() - lastCallMs));
  if (wait > 0) await sleep(wait);
  lastCallMs = Date.now();

  try {
    const url = `${NOMINATIM}?q=${encodeURIComponent(q)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;

    const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    cache.set(key, result);
    return result;
  } catch {
    return null;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
