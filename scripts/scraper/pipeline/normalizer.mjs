/**
 * Normalizer — cleans and standardizes raw data extracted from RSS items.
 *
 * Responsibilities:
 *   - Strip common "open call" prefixes from festival names
 *   - Normalize URLs (remove tracking params, fix protocol)
 *   - Normalize country names to a standard form
 *   - Validate and clamp submission deadlines
 *   - Assign a confidence score to the extracted record
 */

// ── Title prefixes/suffixes that indicate "this is a call for submissions" ──
// We strip these to get the clean festival name.
const NAME_STRIP_PREFIXES = [
  /^(open call|call for (entries|submissions|artists|proposals|applications))[:\s–-]+/i,
  /^(apply (now|today|here)|applications? (open|now open))[:\s–-]+/i,
  /^(submission deadline|deadline)[:\s–-]+/i,
  /^(festival spotlight|festival feature|spotlight)[:\s–-]+/i,
  /^(new opportunity|opportunity)[:\s–-]+/i,
  /^(now open|entries open|applications open)[:\s–-]+/i,
  /^(announcing|announcement)[:\s–-]+/i,
  /^(featured|feature)[:\s–-]+/i,
];

const NAME_STRIP_SUFFIXES = [
  /\s*[–-]\s*(apply now|applications open|submit now|open call|deadline.*)$/i,
  /\s*\|\s*.+$/, // strip "| Source Name" trailing tags
  /\s*\d{4}$/, // strip trailing year if it's all that's left after name
];

// ── Country name normalization ─────────────────────────────────────────────
const COUNTRY_ALIASES = new Map([
  ["uk", "United Kingdom"],
  ["u.k.", "United Kingdom"],
  ["great britain", "United Kingdom"],
  ["britain", "United Kingdom"],
  ["england", "United Kingdom"],
  ["scotland", "United Kingdom"],
  ["wales", "United Kingdom"],
  ["northern ireland", "United Kingdom"],
  ["us", "United States"],
  ["u.s.", "United States"],
  ["usa", "United States"],
  ["u.s.a.", "United States"],
  ["america", "United States"],
  ["the united states", "United States"],
  ["uae", "United Arab Emirates"],
  ["drc", "Democratic Republic of the Congo"],
  ["south korea", "South Korea"],
  ["north korea", "North Korea"],
  ["the netherlands", "Netherlands"],
  ["holland", "Netherlands"],
  ["czechia", "Czech Republic"],
  ["czech rep", "Czech Republic"],
  ["rsa", "South Africa"],
  ["nz", "New Zealand"],
  ["aotearoa", "New Zealand"],
]);

// ── URL tracking parameter prefixes to strip ─────────────────────────────────
const TRACKING_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "ref", "source", "fbclid", "gclid", "msclkid", "mc_cid", "mc_eid",
  "_hsenc", "_hsmi", "hs_email", "hs_subscriber_id",
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Strips common "open call" prefixes and trailing noise from a title.
 * @param {string} raw
 * @returns {string}
 */
export function cleanFestivalName(raw) {
  let name = (raw ?? "").trim();

  for (const re of NAME_STRIP_PREFIXES) {
    name = name.replace(re, "");
  }
  for (const re of NAME_STRIP_SUFFIXES) {
    name = name.replace(re, "");
  }

  return name.trim();
}

/**
 * Returns a canonical country name from various abbreviations/aliases.
 * Returns the original (title-cased) if not found in the alias map.
 * @param {string|null} raw
 * @returns {string|null}
 */
export function normalizeCountry(raw) {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return COUNTRY_ALIASES.get(key) ?? titleCase(raw.trim());
}

/**
 * Removes tracking parameters from a URL and normalizes the protocol.
 * Returns null if the URL is invalid.
 * @param {string|null} raw
 * @returns {string|null}
 */
export function normalizeUrl(raw) {
  if (!raw || typeof raw !== "string") return null;

  let href = raw.trim();

  // Ensure protocol is present
  if (href.startsWith("//")) href = "https:" + href;
  if (!href.match(/^https?:\/\//i)) return null;

  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }

  // Strip tracking params
  for (const param of TRACKING_PARAMS) {
    url.searchParams.delete(param);
  }

  // Strip empty fragment
  if (url.hash === "#") url.hash = "";

  // Remove trailing slash from path (except root)
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}

/**
 * Validates a deadline string (YYYY-MM-DD).
 * Returns the date if reasonable, null if invalid or more than 2 years out.
 * @param {string|null} raw
 * @returns {string|null}
 */
export function validateDeadline(raw) {
  if (!raw) return null;
  const dt = new Date(raw + "T00:00:00Z");
  if (isNaN(dt.getTime())) return null;

  const now = new Date();
  const maxFuture = new Date(now.getFullYear() + 2, 11, 31);

  // Allow deadlines up to 1 year in the past (stale data) and 2 years out
  const minPast = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  if (dt < minPast || dt > maxFuture) return null;

  return raw.slice(0, 10);
}

/**
 * Computes a 0–1 confidence score for the extracted record.
 * Higher = more reliable for auto-publishing (vs requiring admin review).
 * @param {object} record
 * @returns {number}
 */
export function scoreConfidence(record) {
  let score = 0;

  if (record.festival_name && record.festival_name.length >= 4) score += 0.20;
  if (record.country)           score += 0.15;
  if (record.city)              score += 0.10;
  if (record.submission_deadline) score += 0.20;
  if (record.application_url)   score += 0.20;
  if (record.website)           score += 0.10;
  if (record.description && record.description.length > 50) score += 0.05;

  return Math.min(1, score);
}

// ── Internal ──────────────────────────────────────────────────────────────────

function titleCase(str) {
  return str.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}
