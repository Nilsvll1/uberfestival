/**
 * Extractor — pulls structured festival data from an RSS item.
 *
 * An RSS item typically has:
 *   title: "Open Call: Jazz Festival Paris 2026 — Deadline March 15"
 *   description: "Applications are open for Jazz Festival Paris... Location: Paris, France..."
 *   link: "https://jazzfestivalparis.com/apply"
 *   pubDate: "2026-01-15"
 *
 * We extract:
 *   festival_name, country, city, submission_deadline, application_url,
 *   website, description, festival_start_date, festival_end_date, category
 */

import { extractDates } from "../lib/extract-date.mjs";
import { cleanFestivalName, normalizeCountry, normalizeUrl, validateDeadline, scoreConfidence } from "./normalizer.mjs";

// ── Location extraction patterns ──────────────────────────────────────────────

// "Location: Paris, France" or "City: Paris"
const LOCATION_LABEL_RE = /\b(?:location|city|venue|place)[:\s]+([^,\n.]{2,40}),?\s*([^,\n.]{2,40})?/i;

// "Paris, France" / "New York, US" — bare location mention
const BARE_LOCATION_RE = /\b([A-Z][a-zA-Zé\s]{2,25}),\s*([A-Z][a-zA-Z\s]{2,25})\b/;

// ── Genre / category extraction ───────────────────────────────────────────────

const GENRE_PATTERNS = [
  [/\bjazz\b/i,       "Jazz"],
  [/\belectronic\b/i, "Electronic"],
  [/\btechno\b/i,     "Techno"],
  [/\bhouse\b/i,      "Electronic"],
  [/\brock\b/i,       "Rock"],
  [/\bmetal\b/i,      "Metal"],
  [/\bclassical\b/i,  "Classical"],
  [/\bopera\b/i,      "Classical"],
  [/\bfolk\b/i,       "Folk"],
  [/\bcountry\b/i,    "Country"],
  [/\bpop\b/i,        "Pop"],
  [/\bhip.?hop\b/i,   "Hip-Hop"],
  [/\br&b\b/i,        "R&B"],
  [/\brnb\b/i,        "R&B"],
  [/\breggae\b/i,     "Reggae"],
  [/\bworld music\b/i,"World Music"],
  [/\bblues\b/i,      "Blues"],
  [/\bsoul\b/i,       "Soul"],
  [/\bjamb?\b/i,      "Rock"],
  [/\bindependent\b/i,"Indie"],
  [/\bindie\b/i,      "Indie"],
  [/\bexperimental\b/i,"Experimental"],
  [/\bambient\b/i,    "Electronic"],
  [/\bdance\b/i,      "Electronic"],
  [/\blatino?\b/i,    "Latin"],
  [/\bflamenc[oa]\b/i,"World Music"],
];

// ── Application URL signals in description text ───────────────────────────────
const APPLY_URL_RE = /https?:\/\/[^\s"'<>)]+(?:apply|submit|application|entries|open-call)[^\s"'<>)]{0,80}/i;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extracts a structured festival record from an RSS item.
 *
 * @param {{ title: string, link: string|null, description: string, pubDate: string|null, categories: string[] }} item
 * @returns {{ record: object|null, confidence: number, skipReason: string|null }}
 */
export function extractFestivalFromItem(item) {
  const rawName = cleanFestivalName(item.title ?? "");

  if (!rawName || rawName.length < 3) {
    return { record: null, confidence: 0, skipReason: "name too short after cleaning" };
  }
  if (rawName.length > 200) {
    return { record: null, confidence: 0, skipReason: "name too long" };
  }

  // Reject items that look like news articles, not festival opportunities
  if (isNewsArticle(rawName, item.description)) {
    return { record: null, confidence: 0, skipReason: "appears to be news article" };
  }

  const fullText = `${item.title} ${item.description}`;

  // Extract dates from the combined text
  const dates = extractDates(fullText);

  const deadline = validateDeadline(dates.deadline);
  const startDate = dates.festivalStart ? dates.festivalStart.slice(0, 10) : null;
  const endDate   = dates.festivalEnd   ? dates.festivalEnd.slice(0, 10)   : null;

  // Extract location
  const { city, country } = extractLocation(fullText);

  // Application URL: prefer an explicit apply URL in description, else the link
  const applyUrlInDesc = (item.description ?? "").match(APPLY_URL_RE)?.[0] ?? null;
  const isApplyLink = isApplicationUrl(item.link);
  const applicationUrl = normalizeUrl(
    applyUrlInDesc ?? (isApplyLink ? item.link : null)
  );
  const website = normalizeUrl(
    isApplyLink ? null : item.link
  );

  // Category: from RSS categories first, else detect from text
  const category =
    detectGenreFromList(item.categories) ??
    detectGenreFromText(fullText);

  const record = {
    festival_name:       rawName,
    country:             normalizeCountry(country),
    city:                city ?? null,
    category:            category ?? null,
    submission_deadline: deadline,
    festival_start_date: startDate,
    festival_end_date:   endDate,
    application_url:     applicationUrl,
    website:             website,
    description:         (item.description ?? "").slice(0, 1000) || null,
    source_url:          item.link ?? null,
    scrape_status:       "ok",
    is_verified:         false,
    last_seen_at:        new Date().toISOString(),
  };

  const confidence = scoreConfidence(record);

  return { record, confidence, skipReason: null };
}

// ── Location extraction ───────────────────────────────────────────────────────

function extractLocation(text) {
  // Try labeled pattern first: "Location: Paris, France"
  const labeled = text.match(LOCATION_LABEL_RE);
  if (labeled) {
    return { city: labeled[1]?.trim() ?? null, country: labeled[2]?.trim() ?? null };
  }

  // Try bare "City, Country" pattern — only accept if country looks valid (title-case)
  const bare = text.match(BARE_LOCATION_RE);
  if (bare) {
    const city    = bare[1].trim();
    const country = bare[2].trim();
    // Reject matches that are clearly not countries (too long, all-caps, etc.)
    if (country.length <= 30 && !country.match(/^[A-Z]{3,}$/)) {
      return { city, country };
    }
  }

  return { city: null, country: null };
}

// ── Genre detection ───────────────────────────────────────────────────────────

function detectGenreFromList(categories) {
  if (!categories?.length) return null;
  const joined = categories.join(" ").toLowerCase();
  for (const [re, genre] of GENRE_PATTERNS) {
    if (re.test(joined)) return genre;
  }
  return null;
}

function detectGenreFromText(text) {
  for (const [re, genre] of GENRE_PATTERNS) {
    if (re.test(text)) return genre;
  }
  return null;
}

// ── Article vs opportunity ────────────────────────────────────────────────────

const NEWS_SIGNALS = [
  /^(top \d+|the \d+ best|ranking|review|recap|roundup|interview|opinion|guest post)/i,
  /^(how to |why |what is |guide to |tips for |the history of )/i,
  /^(weekly|monthly|daily) (digest|roundup|update|newsletter)/i,
  /\b(press release|announces|awarded|wins|won|unveils|reveals)\b/i,
];

function isNewsArticle(name, description) {
  const combined = `${name} ${description ?? ""}`;
  return NEWS_SIGNALS.some((re) => re.test(combined));
}

function isApplicationUrl(url) {
  if (!url) return false;
  return /\/apply|\/submit|\/application|\/entries|\/open-call|filmfreeway\.com|festhome\.com|submittable\.com/i.test(url);
}
