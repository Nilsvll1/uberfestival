/**
 * Fuzzy matching utilities for festival deduplication.
 *
 * Strategy (layered):
 *   1. Exact URL match → confidence 1.0 (definitive duplicate)
 *   2. Exact normalized-name match (same country) → 0.95
 *   3. Jaccard word-set similarity on name tokens → weighted by location overlap
 *   4. Levenshtein edit distance for short names (<= 5 tokens)
 *
 * Threshold: similarity >= 0.70 is treated as "same festival".
 */

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "of", "at", "in", "on", "for",
  "de", "la", "le", "les", "du", "des", "et", "en",
  "music", "festival", "fest", "music festival",
]);

// Abbreviations and alternate spellings that should count as identical tokens
const EQUIVALENTS = new Map([
  ["intl", "international"],
  ["int", "international"],
  ["int'l", "international"],
  ["&", "and"],
  ["+", "and"],
]);

/**
 * Returns true if the two URLs point to the same resource.
 * Compares normalized hostname + path, ignoring protocol and query/fragment.
 * @param {string|null} a
 * @param {string|null} b
 * @returns {boolean}
 */
export function urlsMatch(a, b) {
  if (!a || !b) return false;
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    const normalize = (u) =>
      (u.hostname + u.pathname).toLowerCase().replace(/\/+$/, "");
    return normalize(ua) === normalize(ub);
  } catch {
    return false;
  }
}

/**
 * Tokenizes a festival name into a canonical word set.
 * @param {string} name
 * @returns {Set<string>}
 */
export function tokenize(name) {
  if (!name) return new Set();
  return new Set(
    name
      .toLowerCase()
      .replace(/[''`]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .map((w) => EQUIVALENTS.get(w) ?? w)
      .filter((w) => !STOP_WORDS.has(w))
  );
}

/**
 * Jaccard similarity of two token sets: |A ∩ B| / |A ∪ B|.
 * @param {Set<string>} a
 * @param {Set<string>} b
 * @returns {number} 0–1
 */
export function jaccard(a, b) {
  if (!a.size && !b.size) return 1;
  if (!a.size || !b.size) return 0;

  const intersection = [...a].filter((w) => b.has(w)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

/**
 * Levenshtein edit distance (character level).
 * Only used for short strings.
 * @param {string} s
 * @param {string} t
 * @returns {number}
 */
export function levenshtein(s, t) {
  const m = s.length, n = t.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = s[i - 1] === t[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Overall similarity score between two festival records.
 *
 * Returns a score in [0, 1]:
 *   >= 0.85 — almost certainly the same festival
 *   0.70–0.84 — very likely the same festival
 *   < 0.70 — treat as different
 *
 * @param {{ festival_name: string, country?: string, city?: string, website?: string, application_url?: string }} a
 * @param {{ festival_name: string, country?: string, city?: string, website?: string, application_url?: string }} b
 * @returns {{ score: number, reason: string }}
 */
export function similarity(a, b) {
  // 1. Exact URL match
  if (
    urlsMatch(a.website, b.website) ||
    urlsMatch(a.application_url, b.application_url) ||
    urlsMatch(a.website, b.application_url) ||
    urlsMatch(a.application_url, b.website)
  ) {
    return { score: 1.0, reason: "url_match" };
  }

  const tokA = tokenize(a.festival_name);
  const tokB = tokenize(b.festival_name);

  // 2. Exact normalized-name match with same country
  const normA = [...tokA].sort().join(" ");
  const normB = [...tokB].sort().join(" ");
  if (normA === normB && normA.length > 0) {
    const sameCountry =
      !a.country ||
      !b.country ||
      a.country.toLowerCase() === b.country.toLowerCase();
    return { score: sameCountry ? 0.95 : 0.80, reason: "name_exact" };
  }

  // 3. Jaccard similarity on name tokens
  let score = jaccard(tokA, tokB);

  // 4. Boost for location overlap
  const sameCountry =
    a.country &&
    b.country &&
    a.country.toLowerCase() === b.country.toLowerCase();
  const sameCity =
    a.city &&
    b.city &&
    a.city.toLowerCase() === b.city.toLowerCase();

  if (sameCity)    score = Math.min(1, score + 0.15);
  if (sameCountry) score = Math.min(1, score + 0.08);

  // 5. For very short names (<= 3 meaningful tokens), supplement with Levenshtein
  if (tokA.size <= 3 && tokB.size <= 3) {
    const na = a.festival_name?.toLowerCase() ?? "";
    const nb = b.festival_name?.toLowerCase() ?? "";
    const maxLen = Math.max(na.length, nb.length);
    if (maxLen > 0) {
      const dist = levenshtein(na, nb);
      const levSim = 1 - dist / maxLen;
      // Weighted average: 60% Jaccard, 40% Levenshtein for short names
      score = 0.6 * score + 0.4 * levSim;
    }
  }

  return { score, reason: "token_similarity" };
}

export const MATCH_THRESHOLD = 0.70;
