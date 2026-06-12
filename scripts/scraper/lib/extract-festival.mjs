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

// ccTLD → country name. Used ONLY as a last resort when no structured geo exists.
// Only includes unambiguous single-country TLDs (not .co, .io, .org, etc.).
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

// ISO 3166-1 alpha-2 → country name, for <meta name="geo.region"> like "GB", "US-CA".
const ISO2_COUNTRY = {
  AF: "Afghanistan",  AL: "Albania",      DZ: "Algeria",      AR: "Argentina",
  AU: "Australia",    AT: "Austria",      BE: "Belgium",      BR: "Brazil",
  CA: "Canada",       CL: "Chile",        CN: "China",        CO: "Colombia",
  HR: "Croatia",      CZ: "Czech Republic", DK: "Denmark",   EG: "Egypt",
  FI: "Finland",      FR: "France",       DE: "Germany",      GH: "Ghana",
  GR: "Greece",       HU: "Hungary",      IN: "India",        ID: "Indonesia",
  IE: "Ireland",      IL: "Israel",       IT: "Italy",        JP: "Japan",
  KE: "Kenya",        KR: "South Korea",  MX: "Mexico",       MA: "Morocco",
  NL: "Netherlands",  NZ: "New Zealand",  NG: "Nigeria",      NO: "Norway",
  PH: "Philippines",  PL: "Poland",       PT: "Portugal",     RO: "Romania",
  RS: "Serbia",       SG: "Singapore",    SI: "Slovenia",     ZA: "South Africa",
  ES: "Spain",        SE: "Sweden",       CH: "Switzerland",  TH: "Thailand",
  TR: "Turkey",       UA: "Ukraine",      GB: "United Kingdom", US: "United States",
};

/**
 * Validates a geo value extracted from structured data.
 * Rejects anything that looks like prose text instead of a place name.
 * Returns the value unchanged, or null if it fails validation.
 */
function sanitizeGeo(value) {
  if (!value || typeof value !== "string") return null;
  const v = value.trim();
  if (!v || v.length > 60) return null;

  const words = v.split(/\s+/);
  if (words.length > 3) return null; // more than 3 words → likely prose, not a place name

  const lower = v.toLowerCase();
  const BAD_WORDS = new Set([
    "contact", "information", "online", "announcement", "news", "please",
    "further", "email", "website", "click", "here", "more", "details",
    "visit", "see", "read", "learn", "get", "apply", "http", "www",
    "available", "open", "for", "via", "and", "the", "all",
  ]);
  if (words.some(w => BAD_WORDS.has(w.replace(/[^a-z]/g, "").toLowerCase()))) return null;

  if (!/^[A-Za-z]/.test(v)) return null; // must start with a letter

  return v;
}

/**
 * Extracts structured festival data from a page's HTML.
 */
export function extractFestivalInfo(html, pageUrl) {
  const $ = cheerio.load(html);

  // Remove noise — but KEEP ld+json scripts.
  $("style, nav, footer, header, aside, .cookie, .gdpr, .banner, .ads").remove();
  $("script:not([type='application/ld+json'])").remove();

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();

  const jsonLd = extractFromJsonLd($, pageUrl);
  const title  = extractTitle($);
  const dates  = extractDates(bodyText);
  const geo    = extractLocation($, pageUrl, jsonLd);
  const genre  = extractGenre(bodyText, title);

  const applicationUrl = extractApplicationUrl($, pageUrl);
  const website = jsonLd.website || extractWebsite($, pageUrl);
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
      let data = JSON.parse($(el).html() ?? "");
      if (Array.isArray(data)) data = data[0];
      if (!data || typeof data !== "object") return;

      const type = String(data["@type"] ?? "");
      const isEvent = /^(MusicEvent|Event|Festival|SocialEvent|MusicFestival)$/i.test(type);
      if (!isEvent) return;

      const loc = data.location;
      if (loc) {
        if (typeof loc === "string") {
          const parts = loc.split(",").map(s => s.trim());
          result.city    = sanitizeGeo(parts[0]) || null;
          result.country = sanitizeGeo(parts[parts.length - 1]) || null;
        } else if (loc.address) {
          result.city    = sanitizeGeo(loc.address.addressLocality || loc.address.addressRegion) || null;
          result.country = sanitizeGeo(loc.address.addressCountry) || null;
        } else if (loc.name) {
          const parts = String(loc.name).split(",").map(s => s.trim());
          if (parts.length >= 2) {
            result.city    = sanitizeGeo(parts[0]) || null;
            result.country = sanitizeGeo(parts[parts.length - 1]) || null;
          }
        }
      }

      if (data.startDate) result.festivalStart = String(data.startDate).slice(0, 10);
      if (data.endDate)   result.festivalEnd   = String(data.endDate).slice(0, 10);
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

  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  if (ogTitle && ogTitle.length > 3 && ogTitle.length < 120) {
    return cleanText(ogTitle.split(/[|\-–—]/)[0].trim());
  }

  const title = $("title").text().trim();
  if (title) return cleanText(title.split(/[|\-–—]/)[0].trim());

  return null;
}

// ─── Location ────────────────────────────────────────────────────────────────
//
// STRICT: only extract from structured data sources. Never infer from prose.
//
// Sources tried (in priority order):
//   1. JSON-LD Event/MusicEvent schema
//   2. Schema.org microdata attributes (itemprop)
//   3. OpenGraph country-name / geo.region meta tags
//   4. ccTLD of the page URL (last resort, no city)
//
// Steps 4 and 5 (prose regex matching) have been intentionally removed.
// They produced values like "please contact online" and
// "All Scotland For further information" — sentences captured by greedy
// regexes on unstructured page text. Country/city must come from structured
// markup or not at all.

function extractLocation($, pageUrl, jsonLd) {
  // 1. JSON-LD (highest confidence — machine-generated by site CMS)
  if (jsonLd.city || jsonLd.country) {
    return { city: jsonLd.city, country: jsonLd.country };
  }

  // 2. Schema.org microdata
  const mdCountry = (
    $('[itemprop="addressCountry"]').first().attr("content") ||
    $('[itemprop="addressCountry"]').first().text()
  ).trim();
  const mdCity = (
    $('[itemprop="addressLocality"]').first().attr("content") ||
    $('[itemprop="addressLocality"]').first().text() ||
    $('[itemprop="addressRegion"]').first().attr("content") ||
    $('[itemprop="addressRegion"]').first().text()
  ).trim();

  if (mdCountry || mdCity) {
    return {
      city:    sanitizeGeo(mdCity)    || null,
      country: sanitizeGeo(mdCountry) || null,
    };
  }

  // 3. OpenGraph / geo meta tags
  const geoRegion = $('meta[name="geo.region"]').attr("content") || "";
  if (geoRegion) {
    const code = geoRegion.split("-")[0].toUpperCase();
    const country = ISO2_COUNTRY[code] || null;
    if (country) return { city: null, country };
  }

  const ogCountry = $('meta[property="og:country-name"]').attr("content")?.trim() || "";
  if (ogCountry) return { city: null, country: sanitizeGeo(ogCountry) || null };

  const ogLocation = $('meta[property="og:location"]').attr("content")?.trim() || "";
  if (ogLocation) {
    const parts = ogLocation.split(",").map(s => s.trim());
    return {
      city:    sanitizeGeo(parts[0]) || null,
      country: sanitizeGeo(parts[parts.length - 1]) || null,
    };
  }

  // 4. ccTLD — last resort, provides country only (no city)
  try {
    const hostname = new URL(pageUrl).hostname;
    const match = Object.entries(TLD_COUNTRY).find(([tld]) => hostname.endsWith(tld));
    if (match) return { city: null, country: match[1] };
  } catch { /* ignore */ }

  return { city: null, country: null };
}

// ─── Genre ───────────────────────────────────────────────────────────────────

function extractGenre(bodyText, title) {
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
    instagram:  /instagram\.com/,
    facebook:   /facebook\.com/,
    twitter:    /twitter\.com|x\.com/,
    youtube:    /youtube\.com/,
    soundcloud: /soundcloud\.com/,
    spotify:    /spotify\.com/,
    tiktok:     /tiktok\.com/,
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
