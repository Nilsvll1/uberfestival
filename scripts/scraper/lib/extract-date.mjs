/**
 * Date extraction from raw HTML / text.
 *
 * Strategy: find text snippets near known deadline keywords, then apply
 * date patterns to those snippets. This dramatically reduces false positives
 * compared to running regex over the entire page.
 */

const MONTH_MAP = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

// Keywords that appear near a submission deadline.
const DEADLINE_KEYWORDS = [
  "deadline",
  "apply by",
  "apply before",
  "applications close",
  "application deadline",
  "submissions close",
  "submission deadline",
  "submit by",
  "submit before",
  "last date to apply",
  "closes on",
  "closing date",
  "entry deadline",
  "due date",
  "last day",
];

// Keywords that appear near festival performance dates.
const DATES_KEYWORDS = [
  "festival dates",
  "takes place",
  "will be held",
  "happening",
  "event dates",
  "festival runs",
  "runs from",
  "performance dates",
];

/**
 * @param {string} text  Plain text (strip HTML before calling)
 * @returns {{ deadline: string|null, festivalStart: string|null, festivalEnd: string|null }}
 */
export function extractDates(text) {
  const lower = text.toLowerCase();
  return {
    deadline: extractNearKeywords(lower, text, DEADLINE_KEYWORDS),
    festivalStart: null, // extracted below if range found
    festivalEnd: null,
    ...extractFestivalDateRange(lower, text),
  };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Searches for a date in the 300-char window around each keyword occurrence.
 * Returns the first valid date found, formatted as YYYY-MM-DD.
 */
function extractNearKeywords(lower, original, keywords) {
  for (const kw of keywords) {
    let pos = 0;
    while (true) {
      const idx = lower.indexOf(kw, pos);
      if (idx === -1) break;

      const window = original.slice(Math.max(0, idx - 30), idx + 300);
      const date = parseDateFromText(window);
      if (date) return date;

      pos = idx + 1;
    }
  }
  return null;
}

function extractFestivalDateRange(lower, original) {
  for (const kw of DATES_KEYWORDS) {
    const idx = lower.indexOf(kw);
    if (idx === -1) continue;

    const window = original.slice(Math.max(0, idx - 10), idx + 400);
    const dates = parseAllDatesFromText(window);
    if (dates.length >= 2) {
      return { festivalStart: dates[0], festivalEnd: dates[1] };
    }
    if (dates.length === 1) {
      return { festivalStart: dates[0], festivalEnd: null };
    }
  }
  return { festivalStart: null, festivalEnd: null };
}

/**
 * Returns the first date found in the text, as ISO YYYY-MM-DD string.
 * Returns null if none found.
 */
function parseDateFromText(text) {
  const all = parseAllDatesFromText(text);
  return all[0] ?? null;
}

/**
 * Returns all dates found in the text, deduped, filtered to future-ish dates.
 */
function parseAllDatesFromText(text) {
  const results = [];
  const now = new Date();
  const twoYearsOut = new Date(now.getFullYear() + 2, 11, 31);

  for (const [y, m, d] of extractRawDates(text)) {
    const dt = new Date(y, m - 1, d);
    // Skip clearly wrong dates: before 2020 or more than 2 years ahead.
    if (dt < new Date(2020, 0, 1) || dt > twoYearsOut) continue;
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (!results.includes(iso)) results.push(iso);
  }

  return results;
}

/**
 * Extracts raw [year, month, day] tuples from text using multiple patterns.
 */
function extractRawDates(text) {
  const results = [];

  // ISO: 2025-12-31
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    results.push([Number(m[1]), Number(m[2]), Number(m[3])]);
  }

  // "December 31, 2025" / "December 31st, 2025"
  const MONTH_RE = Object.keys(MONTH_MAP).join("|");
  const pat1 = new RegExp(
    `\\b(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`,
    "gi"
  );
  for (const m of text.matchAll(pat1)) {
    const month = MONTH_MAP[m[1].toLowerCase()];
    if (month) results.push([Number(m[3]), month, Number(m[2])]);
  }

  // "31 December 2025" / "31st December 2025"
  const pat2 = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_RE})\\s+(\\d{4})\\b`,
    "gi"
  );
  for (const m of text.matchAll(pat2)) {
    const month = MONTH_MAP[m[2].toLowerCase()];
    if (month) results.push([Number(m[3]), month, Number(m[1])]);
  }

  // "Dec 31 2025" / "31 Dec 2025"
  const pat3 = new RegExp(
    `\\b(${MONTH_RE})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`,
    "gi"
  );
  for (const m of text.matchAll(pat3)) {
    const month = MONTH_MAP[m[1].toLowerCase()];
    if (month) results.push([Number(m[3]), month, Number(m[2])]);
  }

  // MM/DD/YYYY or DD/MM/YYYY — ambiguous; we try both and keep valid ones.
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) {
    const a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
    if (a <= 12 && b <= 31) results.push([y, a, b]); // MM/DD
    if (b <= 12 && a <= 31) results.push([y, b, a]); // DD/MM
  }

  return results;
}
