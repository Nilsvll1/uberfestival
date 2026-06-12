import * as cheerio from "cheerio";
import { extractDates } from "./extract-date.mjs";

const GENRE_KEYWORDS = [
  "jazz", "electronic", "classical", "folk", "rock", "pop", "hip-hop", "hiphop",
  "world music", "world", "blues", "country", "metal", "indie", "ambient",
  "experimental", "reggae", "soul", "r&b", "dance", "techno", "house",
  "drum and bass", "dnb", "punk", "alternative", "singer-songwriter",
];

const APPLY_LINK_KEYWORDS = [
  "apply", "application", "submit", "submission", "enter", "register",
  "call for", "open call",
];

// ccTLD → country name fallback when no geographic text is found.
const TLD_COUNTRY = {
  ".de": "Germany",      ".fr": "France",        ".ie": "Ireland",
  ".nl": "Netherlands",  ".be": "Belgium",       ".at": "Austria",
  ".ch": "Switzerland",  ".it": "Italy",         ".es": "Spain",
  ".pt": "Portugal",     ".se": "Sweden",        ".no": "Norway",
  ".dk": "Denmark",      ".fi": "Finland",       ".pl": "Poland",
  ".cz": "Czech Republic", ".ro": "Romania",     ".hu": "Hungary",
  ".gr": "Greece",       ".au": "Australia",     ".nz": "New Zealand",
  ".ca": "Canada",       ".br": "Brazil",        ".mx": "Mexico",
  ".jp": "Japan",        ".kr": "South Korea",   ".in": "India",
  ".za": "South Africa", ".ng": "Nigeria",       ".ke": "Kenya",
  ".ar": "Argentina",    ".cl": "Chile",         ".co": "Colombia",
  ".tr": "Turkey",       ".ua": "Ukraine",       ".hr": "Croatia",
  ".si": "Slovenia",     ".rs": "Serbia",        ".sg": "Singapore",
  ".th": "Thailand",     ".ph": "Philippines",   ".il": "Israel",
  ".ma": "Morocco",      ".eg": "Egypt",         ".gh": "Ghana",
};

// Country names checked against body text (longer strings first to avoid substrings).
const COUNTRY_PATTERNS = [
  ["united states of america", "United States"],
  ["united states", "United States"],
  ["united kingdom", "United Kingdom"],
  ["new zealand", "New Zealand"],
  ["south africa", "South Africa"],
  ["south korea", "South Korea"],
  ["czech republic", "Czech Republic"],
  ["netherlands", "Netherlands"],
  ["switzerland", "Switzerland"],
  ["philippines", "Philippines"],
  ["australia", "Australia"],
  ["argentina", "Argentina"],
  ["singapore", "Singapore"],
  ["indonesia", "Indonesia"],
  ["colombia", "Colombia"],
  ["portugal", "Portugal"],
  ["malaysia", "Malaysia"],
  ["thailand", "Thailand"],
  ["slovakia", "Slovakia"],
  ["slovenia", "Slovenia"],
  ["ethiopia", "Ethiopia"],
  ["denmark", "Denmark"],
  ["belgium", "Belgium"],
  ["finland", "Finland"],
  ["austria", "Austria"],
  ["ukraine", "Ukraine"],
  ["croatia", "Croatia"],
  ["romania", "Romania"],
  ["hungary", "Hungary"],
  ["germany", "Germany"],
  ["ireland", "Ireland"],
  ["nigeria", "Nigeria"],
  ["ecuador", "Ecuador"],
  ["morocco", "Morocco"],
  ["sweden", "Sweden"],
  ["norway", "Norway"],
  ["poland", "Poland"],
  ["russia", "Russia"],
  ["brazil", "Brazil"],
  ["mexico", "Mexico"],
  ["france", "France"],
  ["canada", "Canada"],
  ["israel", "Israel"],
  ["turkey", "Turkey"],
  ["greece", "Greece"],
  ["india", "India"],
  ["ghana", "Ghana"],
  ["kenya", "Kenya"],
  ["egypt", "Egypt"],
  ["japan", "Japan"],
  ["spain", "Spain"],
  ["italy", "Italy"],
  ["chile", "Chile"],
  ["china", "China"],
  ["peru", "Peru"],
  ["usa", "United States"],
  ["u.s.a.", "United States"],
  ["uk", "United Kingdom"],
];

// Words that give location context to a nearby country name.
const LOCATION_CONTEXT_WORDS = [
  "festival", "held in", "takes place", "located in", "based in",
  "venue", "city", "location", "country", "address", "hosted in",
  "happening in", "performed in", "event in",
];

/**
 * Extracts structured festival data from a page's HTML.
 *
 * @param {string} html
 * @param {string} pageUrl
 * @returns {object}
 */
export function extractFestivalInfo(html, pageUrl) {
  const $ = cheerio.load(html);

  // Remove noise — but KEEP ld+json scripts for parsing.
  $("style, nav, footer, header, aside, .cookie, .gdpr, .banner, .ads").remove();
  $("script:not([type='application/ld+json'])").remove();

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();

  // JSON-LD Event schema — most reliable source.
  const jsonLd = extractFromJsonLd($, pageUrl);

  const title   = extractTitle($);
  const dates   = extractDates(bodyText);
  const geo     = extractLocation($, bodyText, pageUrl, jsonLd);
  const genre   = extractGenre(bodyText, title);

  const applicationUrl = extractApplicationUrl($, pageUrl);
  const website = jsonLd.website || extractWebsite($, pageUrl);

  // Requirement #4: never leave application_url null when website exists.
  const finalApplicationUrl = applicationUrl || website || null;

  return {
    festival_name:       title || null,
    country:             geo.country || null,
    city:                geo.city    || null,
    genre:               genre       || null,
    application_url:     finalApplicationUrl,
    submission_deadline: jsonLd.deadline      || dates.deadline      || null,
    festival_start_date: jsonLd.festivalStart || dates.festivalStart || null,
    festival_end_date:   jsonLd.festivalEnd   || dates.festivalEnd   || null,
    website:             website              || null,
    social_links:        extractSocialLinks($) || null,
    source_url:          pageUrl,
    raw_text:            bodyText.slice(0, 2000),
  };
}

// ─── JSON-LD ─────────────────────────────────────────────────────────────────

function extractFromJsonLd($, pageUrl) {
  const result = {
    city: null, country: null,
    deadline: null, festivalStart: null, festivalEnd: null,
    website: null,
  };

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      let raw = $(el).html() ?? "";
      let data = JSON.parse(raw);
      if (Array.isArray(data)) data = data[0];
      if (!data || typeof data !== "object") return;

      const type = String(data["@type"] ?? "");
      const isEvent = /^(MusicEvent|Event|Festival|SocialEvent|MusicFestival)$/i.test(type);
      if (!isEvent) return;

      // Location
      const loc = data.location;
      if (loc) {
        if (typeof loc === "string") {
          const parts = loc.split(",").map(s => s.trim());
          result.city    = parts[0] || null;
          result.country = parts[parts.length - 1] || null;
        } else if (loc.address) {
          result.city    = loc.address.addressLocality || loc.address.addressRegion || null;
          result.country = loc.address.addressCountry  || null;
        } else if (loc.name) {
          const parts = String(loc.name).split(",").map(s => s.trim());
          if (parts.length >= 2) {
            result.city    = parts[0];
            result.country = parts[parts.length - 1];
          }
        }
      }

      // Dates
      if (data.startDate) result.festivalStart = String(data.startDate).slice(0, 10);
      if (data.endDate)   result.festivalEnd   = String(data.endDate).slice(0, 10);

      // Website
      if (data.url) {
        try { result.website = new URL(data.url).href; } catch { /* ignore */ }
      }
    } catch { /* malformed JSON-LD */ }
  });

  return result;
}

// ─── Title ───────────────────────────────────────────────────────────────────

function extractTitle($) {
  const h1 = $("h1").first().text().trim();
  if (h1 && h1.length > 3 && h1.length < 120) return cleanText(h1);

  const title = $("title").text().trim();
  if (title) return cleanText(title.split(/[|\-–—]/)[0].trim());

  return null;
}

// ─── Location ────────────────────────────────────────────────────────────────

function extractLocation($, bodyText, pageUrl, jsonLd) {
  // 1. JSON-LD (already parsed above — most reliable).
  if (jsonLd.city || jsonLd.country) {
    return { city: jsonLd.city, country: jsonLd.country };
  }

  // 2. Schema.org microdata attributes.
  const mdCountry = $('[itemprop="addressCountry"]').first().text().trim() ||
                    $('[itemprop="addressCountry"]').first().attr("content") || "";
  const mdCity    = $('[itemprop="addressLocality"], [itemprop="addressRegion"]').first().text().trim() ||
                    $('[itemprop="addressLocality"]').first().attr("content") || "";
  if (mdCountry || mdCity) {
    return { city: mdCity || null, country: mdCountry || null };
  }

  // 3. OpenGraph / geo meta tags.
  const ogLocation = $('meta[property="og:location"]').attr("content") ||
                     $('meta[name="geo.region"]').attr("content") || "";
  if (ogLocation) {
    const parts = ogLocation.split(",").map(s => s.trim());
    if (parts.length >= 2) return { city: parts[0], country: parts[1] };
    return { city: null, country: parts[0] || null };
  }

  // 4. Text pattern: "Location: City, Country" within first 3000 chars.
  const snippet = bodyText.slice(0, 3000);
  const locMatch = snippet.match(
    /(?:location|venue|city|held in|takes place in|based in|hosted in|organized in)[:\s]+([A-Z][a-zA-Z\s\-]+),\s*([A-Z][a-zA-Z\s]+)/i
  );
  if (locMatch) {
    return { city: cleanText(locMatch[1]), country: cleanText(locMatch[2]) };
  }

  // "City, Country" after a known location preposition.
  const inMatch = snippet.match(/\b(?:in|at)\s+([A-Z][a-zA-Z\s]{2,30}),\s*([A-Z][a-zA-Z\s]{3,30})\b/);
  if (inMatch) {
    const [, cityPart, countryPart] = inMatch;
    const known = COUNTRY_PATTERNS.find(
      ([pat]) => countryPart.toLowerCase().trim() === pat
    );
    if (known) return { city: cleanText(cityPart), country: known[1] };
  }

  // 5. Country name in body text near a location-context word.
  const lower = bodyText.toLowerCase();
  for (const [pattern, canonical] of COUNTRY_PATTERNS) {
    let pos = 0;
    while (true) {
      const idx = lower.indexOf(pattern, pos);
      if (idx === -1) break;
      const window = lower.slice(Math.max(0, idx - 250), idx + 250);
      const hasContext = LOCATION_CONTEXT_WORDS.some(ctx => window.includes(ctx));
      if (hasContext) return { city: null, country: canonical };
      pos = idx + 1;
    }
  }

  // 6. TLD-based country — last resort, no city.
  try {
    const hostname = new URL(pageUrl).hostname;
    const match = Object.entries(TLD_COUNTRY).find(([tld]) => hostname.endsWith(tld));
    if (match) return { city: null, country: match[1] };
  } catch { /* ignore */ }

  return { city: null, country: null };
}

// ─── Genre ───────────────────────────────────────────────────────────────────

function extractGenre(bodyText, title) {
  // Title/H1 is more reliable than body text.
  const titleLower = (title ?? "").toLowerCase();
  for (const genre of GENRE_KEYWORDS) {
    if (titleLower.includes(genre)) return capitalise(genre);
  }
  const lower = bodyText.toLowerCase();
  for (const genre of GENRE_KEYWORDS) {
    if (lower.includes(genre)) return capitalise(genre);
  }
  return null;
}

// ─── Application URL ─────────────────────────────────────────────────────────

function extractApplicationUrl($, pageUrl) {
  const base = new URL(pageUrl);
  let best = null;

  $("a[href]").each((_, el) => {
    const text = $(el).text().toLowerCase().trim();
    const href = $(el).attr("href") ?? "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;

    const isApplyLink = APPLY_LINK_KEYWORDS.some(
      kw => text.includes(kw) || href.toLowerCase().includes(kw)
    );
    if (!isApplyLink) return;

    try {
      const abs = new URL(href, base).href;
      const isExternal = !abs.includes(base.hostname);
      if (!best || isExternal) best = abs;
    } catch { /* unparseable URL */ }
  });

  return best;
}

// ─── Website ─────────────────────────────────────────────────────────────────

function extractWebsite($, pageUrl) {
  const og = $('meta[property="og:url"]').attr("content");
  if (og) { try { return new URL(og).href; } catch { /* ignore */ } }

  const canonical = $('link[rel="canonical"]').attr("href");
  if (canonical) { try { return new URL(canonical, pageUrl).href; } catch { /* ignore */ } }

  return pageUrl;
}

// ─── Social links ─────────────────────────────────────────────────────────────

function extractSocialLinks($) {
  const platforms = {
    instagram: /instagram\.com/,
    facebook:  /facebook\.com/,
    twitter:   /twitter\.com|x\.com/,
    youtube:   /youtube\.com/,
    soundcloud: /soundcloud\.com/,
    spotify:   /spotify\.com/,
    tiktok:    /tiktok\.com/,
  };
  const links = {};
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    for (const [platform, re] of Object.entries(platforms)) {
      if (re.test(href) && !links[platform]) links[platform] = href;
    }
  });
  return Object.keys(links).length > 0 ? links : null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanText(s) { return s.replace(/\s+/g, " ").trim(); }
function capitalise(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
