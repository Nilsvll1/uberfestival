/**
 * Batch-fetches English Wikipedia article URLs for Wikidata entity IDs.
 *
 * Uses the Wikidata wbgetentities API — up to 50 IDs per request.
 * Returns a Map<qid, wikipedia_url>.
 */

const API = "https://www.wikidata.org/w/api.php";
const UA  = "UberFestivalBot/1.0 (https://uberfestival.com; music-festival-enrichment)";

/**
 * @param {string[]} qids — array of Wikidata Q-IDs, e.g. ["Q309066", "Q181811"]
 * @returns {Promise<Map<string, string>>} Map from Q-ID to English Wikipedia article URL
 */
export async function batchGetWikipediaUrls(qids) {
  const result = new Map();
  if (!qids.length) return result;

  for (let i = 0; i < qids.length; i += 50) {
    const batch = qids.slice(i, i + 50);
    const url = `${API}?action=wbgetentities&ids=${batch.join("|")}&props=sitelinks/urls&sitefilter=enwiki&format=json&languages=en`;

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA },
        signal:  AbortSignal.timeout(20_000),
      });
      if (!res.ok) continue;

      const data = await res.json();
      for (const [qid, entity] of Object.entries(data.entities ?? {})) {
        const link = entity.sitelinks?.enwiki;
        if (link?.url) result.set(qid, link.url);
      }
    } catch { /* skip batch on error */ }

    if (i + 50 < qids.length) await sleep(600);
  }

  return result;
}

/**
 * Extracts the Q-ID from a Wikidata entity URL.
 * "http://www.wikidata.org/entity/Q309066" → "Q309066"
 */
export function extractQid(sourceUrl) {
  const m = sourceUrl?.match(/\/entity\/(Q\d+)$/);
  return m ? m[1] : null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
