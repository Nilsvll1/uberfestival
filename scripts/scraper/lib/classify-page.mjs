/**
 * classify-page.mjs
 *
 * Quality gate for discovered pages. Decides whether a page is an actual
 * festival / open-call opportunity or should be discarded.
 *
 * Scoring starts at 40 (below the accept threshold). The page must
 * accumulate enough positive signals to cross 55.
 *
 * Returns: { confidence: 0–100, accept: boolean, reason: string }
 */

// ── Instant-reject: social media and streaming domains ────────────────────────

const BLOCKED_DOMAINS = new Set([
  "instagram.com", "facebook.com", "twitter.com", "x.com", "tiktok.com",
  "youtube.com", "youtu.be", "spotify.com", "soundcloud.com", "deezer.com",
  "tidal.com", "apple.com", "amazon.com", "reddit.com", "wikipedia.org",
  "linkedin.com", "pinterest.com", "snapchat.com", "vimeo.com", "twitch.tv",
  "discord.com", "bandcamp.com",
]);

// ── URL path patterns that indicate non-opportunity content ──────────────────

const BLOCKED_PATH_RES = [
  /\/blog\//i,
  /\/article/i,
  /\/news\/[a-z]/i,
  /\/resource/i,
  /\/guide\//i,
  /\/tools?\//i,
  /\/pricing/i,
  /\/features/i,
  /\/about(-us)?/i,
  /\/tag\//i,
  /\/category\//i,
  /\/author\//i,
  /\/page\/\d+/i,
  /\/support\//i,
  /\/help\//i,
  /\/faq/i,
];

// ── Title patterns indicating blog posts / SaaS marketing ────────────────────

const ARTICLE_TITLE_RES = [
  /^how to /i,
  /^best \d/i,
  /^top \d/i,
  /^\d+ (ways|tips|tricks|reasons|tools)/i,
  /^the (complete|ultimate|definitive) guide/i,
  /^the (easiest|fastest|simplest|best) way to /i,
  /^what is /i,
  /^why you should/i,
  /getting started with/i,
  /beginner.{0,3}s guide/i,
  /for dummies/i,
  /everything you need to know/i,
  /^a guide to /i,
];

// ── Positive: strong signals that this is a real opportunity ─────────────────

const OPPORTUNITY_SIGNALS = [
  // Direct apply / submit language
  "apply now", "apply today", "submit your", "open call",
  "call for entries", "call for artists", "call for applications",
  "call for submissions", "call for performers", "call for musicians",
  "artist submission", "band submission", "musician submission",
  "artist applications", "application deadline", "submission deadline",
  "apply before", "apply by", "applications open", "applications now open",
  "accepting applications", "accepting submissions", "entries open",
  "artist residency", "music residency", "festival application",
  "showcase application", "festival submission", "open for applications",
  "emerging artists", "unsigned artists", "open auditions",
  // Awards / competitions / showcase submissions
  "award submissions", "showcase submissions", "competition entry",
  "competition entries", "nominations open", "accepting nominations",
  "award submission", "award entry", "enter the competition",
  // Grants / funding vocabulary (arts councils, music foundations)
  "grant application", "apply for funding", "funding deadline",
  "apply for a grant", "bursary", "artist bursary", "music bursary",
  "artist grant", "music grant",
  // Residency (covers "artist in residence / AIR" programmes)
  "residency application", "apply for a residency",
  "artist in residence", "artists in residence",
  "apply to this residency", "apply for the residency",
  // Program / cohort applications (fellowships, music export programs)
  "apply to join", "apply to this program", "apply to our program",
];

// Keywords in the title / H1 that affirm this is a festival/opportunity page.
const FESTIVAL_TITLE_KEYWORDS = [
  "festival", "open call", "call for", "showcase", "residency",
  "artist call", "submission", "audition", "music event",
  // Awards and competitions are also valid opportunities
  "competition", "award", "grant", "bursary",
];

// ── Negative: tool / SaaS / music-industry-marketing signals ─────────────────

const TOOL_SIGNALS = [
  "pricing", "sign up free", "get started free", "start free trial",
  "14-day free trial", "30-day free trial", "free forever",
  "upgrade to pro", "content id", "distribute your music",
  "music distribution platform", "royalties calculator",
  "music marketing tool", "grow your fanbase", "get more streams",
  "playlist pitching", "music promotion service",
  "cancel anytime", "no credit card required",
  "try for free today", "unlimited uploads", "release your music",
  "for labels", "for artists tools",
  // Platform-for-organizers signals (CaFE, etc.) — these pitch to event
  // organizers, not to artists applying to festivals.
  "manage your call", "manage your submission", "manage your open call",
  "manage your entry", "host your call for", "create your call for",
  "software for organizing", "platform for organizers",
];

// ─────────────────────────────────────────────────────────────────────────────

export const ACCEPT_THRESHOLD = 55;

/**
 * @param {string} url
 * @param {object} extracted  Fields from extractFestivalInfo()
 * @returns {{ confidence: number, accept: boolean, reason: string }}
 */
export function classifyPage(url, extracted) {
  let score = 40;
  const notes = [];

  // ── Hard requirements ─────────────────────────────────────────────────────
  if (!extracted.festival_name) {
    return { confidence: 0, accept: false, reason: "no festival_name extracted" };
  }
  if (!extracted.website && !extracted.application_url) {
    return { confidence: 0, accept: false, reason: "no website or application_url" };
  }

  // ── Domain block ──────────────────────────────────────────────────────────
  let hostname = "";
  let pathname = "";
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname.replace(/^www\./, "");
    pathname = parsed.pathname;
  } catch { /* malformed URL — continue with empty strings */ }

  const isDomainBlocked = BLOCKED_DOMAINS.has(hostname) ||
    [...BLOCKED_DOMAINS].some(d => hostname.endsWith(`.${d}`));
  if (isDomainBlocked) {
    return { confidence: 0, accept: false, reason: `blocked domain: ${hostname}` };
  }

  // ── URL path block ────────────────────────────────────────────────────────
  const matchedPath = BLOCKED_PATH_RES.find(re => re.test(pathname));
  if (matchedPath) {
    score -= 30;
    notes.push(`non-opportunity path: ${pathname}`);
  }

  // ── Title quality ─────────────────────────────────────────────────────────
  const title = extracted.festival_name.toLowerCase();

  if (ARTICLE_TITLE_RES.some(re => re.test(title))) {
    score -= 25;
    notes.push("title matches article/blog pattern");
  }
  if (FESTIVAL_TITLE_KEYWORDS.some(kw => title.includes(kw))) {
    score += 25;
    notes.push("festival/opportunity keyword in title");
  }

  // ── Content analysis ──────────────────────────────────────────────────────
  const body = (extracted.raw_text ?? "").toLowerCase();

  const oppHits = OPPORTUNITY_SIGNALS.filter(s => body.includes(s));
  if (oppHits.length >= 3) {
    score += 30;
    notes.push(`${oppHits.length} opportunity signals`);
  } else if (oppHits.length === 2) {
    score += 20;
    notes.push("2 opportunity signals");
  } else if (oppHits.length === 1) {
    score += 10;
    notes.push(`1 signal: "${oppHits[0]}"`);
  } else {
    score -= 20;
    notes.push("no opportunity signals found");
  }

  const toolHits = TOOL_SIGNALS.filter(s => body.includes(s));
  if (toolHits.length >= 3) {
    score -= 40;
    notes.push(`${toolHits.length} SaaS/tool signals`);
  } else if (toolHits.length >= 2) {
    score -= 25;
    notes.push(`${toolHits.length} tool signals`);
  } else if (toolHits.length === 1) {
    score -= 12;
    notes.push(`tool signal: "${toolHits[0]}"`);
  }

  // ── Structured data bonuses ───────────────────────────────────────────────
  if (extracted.submission_deadline) { score += 15; notes.push("has deadline"); }
  if (extracted.country)             { score += 10; notes.push("has country"); }
  else                               { score -=  5; notes.push("no country"); }
  if (extracted.application_url)     { score +=  5; notes.push("has apply URL"); }

  // ── Clamp and decide ──────────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, score));

  return {
    confidence: score,
    accept: score >= ACCEPT_THRESHOLD,
    reason: notes.join("; "),
  };
}
