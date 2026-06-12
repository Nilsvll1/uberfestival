/**
 * classify-page.mjs
 *
 * Quality gate for discovered pages. Decides whether a page is an actual
 * festival / open-call opportunity or should be discarded.
 *
 * Scoring starts at 40 (below the accept threshold of 60). A page must
 * accumulate enough positive signals to cross 60.
 *
 * Hard rejects (confidence=0) fire before scoring:
 *   • Social media / streaming domain
 *   • Person-name title (e.g. "Chris Walker") with no music context
 *   • Profile / account / login page URL path
 *   • Missing festival_name or website
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

// ── Instant-reject: profile, account, and login page URL paths ────────────────
// These paths indicate artist bios, user dashboards, or auth pages — never
// a festival or open call.

const BLOCKED_PROFILE_PATH_RES = [
  /\/musician\//i,
  /\/performer\//i,
  /\/profile\//i,
  /\/user\//i,
  /\/account\//i,
  /\/my-/i,
  /\/login\b/i,
  /\/sign-?in\b/i,
  /\/signup\b/i,
  /\/register\b/i,
  /\/dashboard\b/i,
  /\/members?\//i,
];

// ── Person-name detection ─────────────────────────────────────────────────────
// A title of exactly two capitalised words (e.g. "Chris Walker") with no
// music / event context is almost always a musician profile page.

const PERSON_NAME_RE = /^[A-Z][a-z'-]+ [A-Z][a-z'-]+$/;

// Words that prove the title belongs to a festival/event, not a person.
const PERSON_NAME_MUSIC_CONTEXT = new Set([
  "jazz", "folk", "rock", "pop", "blues", "soul", "country", "indie",
  "electronic", "classical", "world", "reggae", "punk", "metal", "ambient",
  "techno", "house", "dance", "acoustic", "gospel", "latin", "afrobeat",
  "sound", "music", "arts", "band", "song", "tune", "festival",
  "open", "showcase", "award", "competition", "grant", "residency",
  "ensemble", "orchestra", "quartet", "trio", "collective", "society",
  "foundation", "institute", "academy", "project", "community", "union",
  "network", "conference", "summit", "forum", "connect", "exchange",
  "talent", "emerging", "artist", "musician", "singer", "composer",
  "north", "south", "east", "west", "global", "international", "national",
  "new", "big", "great", "free", "live", "young", "summer", "winter",
  "spring", "annual", "series", "city",
  // Programme/scheme words that appear in 2-word grant/funding titles
  // e.g. "Early Career", "Next Steps", "Open Fund", "Development Programme"
  "career", "early", "next", "step", "steps", "scheme", "programme",
  "program", "fund", "prize", "fellowship", "access", "future", "bridge",
  "debut", "launch", "track", "path", "momentum", "catalyst",
]);

// ── URL path patterns indicating non-opportunity content ─────────────────────

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

// ── Exact-match generic page titles — directory/listing/hub pages
// These are page-section headings, not specific opportunity names.
const GENERIC_PAGE_TITLES = new Set([
  "opportunities", "funding", "grants", "awards", "competitions", "residencies",
  "programs", "programmes", "showcases", "resources", "events", "news", "blog",
  "home", "about", "contact", "articles", "members", "listing", "directory",
  "launching soon", "coming soon", "under construction",
  "faq", "frequently asked questions", "grantee faq", "featured articles",
  "announcements", "newsletter", "apply", "submit", "applications", "submissions",
  "what we fund", "who we fund", "our work", "our programmes", "our programs",
  "open calls", "latest opportunities", "current opportunities",
  "funding opportunities", "support", "help", "services",
]);

// ── Regex patterns for titles that are announcements or news posts
const ANNOUNCEMENT_TITLE_RES = [
  /^announcing\b/i,                         // "Announcing Over 300 New Showcase Artists"
  /^we('re| are) (excited|pleased|proud)/i, // "We're excited to announce..."
  /\bover \d+\s+(new|emerging)\b/i,         // "Over 300 New Showcase Artists"
  /^grantee\b/i,                            // "Grantee FAQ", "Grantee Resources"
  /^recipient\b/i,                          // "Recipients 2024"
  /\b20\d\d (recipients|grantees|winners)\b/i, // "2025 Recipients"
  /^meet (the|our)\b/i,                     // "Meet the Artists"
  /^introducing\b/i,                        // "Introducing our new cohort"
  /^update:/i,                              // "Update: Applications now..."
  /^news:/i,
];

// ── Phrases that must NOT appear anywhere in the country or city field
const GEO_BAD_PHRASES = [
  "contact", "information", "online", "announcement", "news", "please",
  "further", "email", "website", "click", "here", "details", "visit",
  "scotland for", "england for", "ireland for", "wales for",
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
  "manage your call", "manage your submission", "manage your open call",
  "manage your entry", "host your call for", "create your call for",
  "software for organizing", "platform for organizers",
];

// ─────────────────────────────────────────────────────────────────────────────

export const ACCEPT_THRESHOLD = 60;

/**
 * @param {string} url
 * @param {object} extracted  Fields from extractFestivalInfo()
 * @returns {{ confidence: number, accept: boolean, reason: string }}
 */
export function classifyPage(url, extracted) {
  let score = 40;
  const notes = [];

  // ── Hard requirement: extracted fields ────────────────────────────────────
  if (!extracted.festival_name) {
    return { confidence: 0, accept: false, reason: "no festival_name extracted" };
  }
  if (!extracted.website && !extracted.application_url) {
    return { confidence: 0, accept: false, reason: "no website or application_url" };
  }

  // ── Hard reject: generic listing/directory page title ────────────────────
  if (GENERIC_PAGE_TITLES.has(extracted.festival_name.trim().toLowerCase())) {
    return { confidence: 0, accept: false, reason: `generic page title: "${extracted.festival_name}"` };
  }

  // ── Hard reject: announcement / news post title ───────────────────────────
  if (ANNOUNCEMENT_TITLE_RES.some(re => re.test(extracted.festival_name.trim()))) {
    return { confidence: 0, accept: false, reason: `announcement/news title: "${extracted.festival_name}"` };
  }

  // ── Hard reject: malformed country or city field ──────────────────────────
  // Catches extraction artifacts like "please contact online" or
  // "All Scotland For further information" that slipped through sanitizeGeo.
  if (extracted.country) {
    const cLower = extracted.country.toLowerCase();
    const cWords = extracted.country.trim().split(/\s+/);
    if (cWords.length > 3 || GEO_BAD_PHRASES.some(p => cLower.includes(p))) {
      return { confidence: 0, accept: false, reason: `invalid country value: "${extracted.country}"` };
    }
  }
  if (extracted.city) {
    const cLower = extracted.city.toLowerCase();
    const cWords = extracted.city.trim().split(/\s+/);
    if (cWords.length > 4 || GEO_BAD_PHRASES.some(p => cLower.includes(p))) {
      return { confidence: 0, accept: false, reason: `invalid city value: "${extracted.city}"` };
    }
  }

  // ── Hard reject: person name pattern ─────────────────────────────────────
  // "Chris Walker", "Dave Shank", "Featured Articles" → confidence=0
  // Exception: a title word is a known music/event context word.
  if (PERSON_NAME_RE.test(extracted.festival_name.trim())) {
    const words = extracted.festival_name.toLowerCase().split(/\s+/);
    if (!words.some(w => PERSON_NAME_MUSIC_CONTEXT.has(w))) {
      return { confidence: 0, accept: false, reason: "title matches person name (no music context)" };
    }
  }

  // ── Parse URL ────────────────────────────────────────────────────────────
  let hostname = "";
  let pathname = "";
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname.replace(/^www\./, "");
    pathname = parsed.pathname;
  } catch { /* malformed URL */ }

  // ── Hard reject: blocked social media / streaming domain ──────────────────
  const isDomainBlocked = BLOCKED_DOMAINS.has(hostname) ||
    [...BLOCKED_DOMAINS].some(d => hostname.endsWith(`.${d}`));
  if (isDomainBlocked) {
    return { confidence: 0, accept: false, reason: `blocked domain: ${hostname}` };
  }

  // ── Hard reject: profile / account / login page ───────────────────────────
  if (BLOCKED_PROFILE_PATH_RES.some(re => re.test(pathname))) {
    return { confidence: 0, accept: false, reason: `profile/account/login page: ${pathname}` };
  }

  // ── URL path penalty ─────────────────────────────────────────────────────
  const matchedPath = BLOCKED_PATH_RES.find(re => re.test(pathname));
  if (matchedPath) {
    score -= 30;
    notes.push(`non-opportunity path: ${pathname}`);
  }

  // ── Title quality ────────────────────────────────────────────────────────
  const title = extracted.festival_name.toLowerCase();

  if (ARTICLE_TITLE_RES.some(re => re.test(title))) {
    score -= 25;
    notes.push("title matches article/blog pattern");
  }
  if (FESTIVAL_TITLE_KEYWORDS.some(kw => title.includes(kw))) {
    score += 25;
    notes.push("festival/opportunity keyword in title");
  }

  // ── Content: opportunity signals ─────────────────────────────────────────
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

  // ── Content: tool / SaaS signals ─────────────────────────────────────────
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

  // ── Structured data ──────────────────────────────────────────────────────
  if (extracted.submission_deadline) { score += 15; notes.push("has deadline"); }
  if (extracted.country)             { score += 10; notes.push("has country"); }
  else                               { score -= 15; notes.push("no country — heavy penalty"); }
  if (extracted.application_url)     { score +=  5; notes.push("has apply URL"); }

  // ── Clamp and decide ─────────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, score));

  return {
    confidence: score,
    accept: score >= ACCEPT_THRESHOLD,
    reason: notes.join("; "),
  };
}
