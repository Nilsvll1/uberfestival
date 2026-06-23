/**
 * Deduplicator — loads existing festivals from the DB and finds the best
 * match for an incoming RSS-extracted record.
 *
 * Loads festivals into a local in-memory index at startup to avoid N+1
 * queries (one DB query → match all RSS items in-process).
 */

import { similarity, MATCH_THRESHOLD } from "./fuzzy.mjs";

/**
 * Builds an in-memory deduplication index from the festivals table.
 *
 * @param {import('@supabase/postgrest-js').PostgrestClient} db
 * @returns {Promise<FestivalIndex>}
 */
export async function buildFestivalIndex(db) {
  // Fetch only the columns needed for matching — keep the payload small
  const { data, error } = await db
    .from("festivals")
    .select("id, festival_name, country, city, website, application_url, submission_deadline, is_archived")
    .neq("is_archived", true);

  if (error) throw new Error(`[deduplicator] Failed to load festivals: ${error.message}`);

  const festivals = data ?? [];
  console.log(`[deduplicator] Loaded ${festivals.length} active festivals into index`);

  return {
    festivals,
    /**
     * Finds the best matching festival for a record.
     *
     * @param {{ festival_name: string, country?: string, city?: string, website?: string, application_url?: string }} record
     * @returns {{ match: object|null, score: number, reason: string }}
     */
    findMatch(record) {
      let bestMatch  = null;
      let bestScore  = 0;
      let bestReason = "none";

      for (const existing of festivals) {
        const { score, reason } = similarity(record, existing);
        if (score > bestScore) {
          bestScore  = score;
          bestMatch  = existing;
          bestReason = reason;
        }
        // Short-circuit on definitive URL match
        if (score >= 1.0) break;
      }

      if (bestScore < MATCH_THRESHOLD) {
        return { match: null, score: bestScore, reason: "no_match" };
      }

      return { match: bestMatch, score: bestScore, reason: bestReason };
    },
  };
}
