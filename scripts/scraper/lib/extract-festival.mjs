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

/**
 * Extracts structured festival data from a page's HTML.
 *
 * @param {string} html
 * @param {string} pageUrl
 * @returns {Partial<StagedFestival>}
 */
export function extractFestivalInfo(html, pageUrl) {
  const $ = cheerio.load(html);

  // Remove noise elements.
  $("script, style, nav, footer, header, aside, .cookie, .gdpr, .banner").remove();

  const title = extractTitle($);
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const { deadline, festivalStart, festivalEnd } = extractDates(bodyText);
  const { country, city } = extractLocation($, bodyText);
  const genre = extractGenre(bodyText);
  const applicationUrl = extractApplicationUrl($, pageUrl);
  const website = extractWebsite($, pageUrl);
  const socialLinks = extractSocialLinks($);

  return {
    festival_name: title || null,
    country: country || null,
    city: city || null,
    genre: genre || null,
    application_url: applicationUrl || null,
    submission_deadline: deadline || null,
    festival_start_date: festivalStart || null,
    festival_end_date: festivalEnd || null,
    website: website || null,
    social_links: Object.keys(socialLinks).length > 0 ? socialLinks : null,
    source_url: pageUrl,
    raw_text: bodyText.slice(0, 2000),
  };
}

// ─── Internal extractors ─────────────────────────────────────────────────────

function extractTitle($) {
  // Prefer the page <h1>, falling back to <title>.
  const h1 = $("h1").first().text().trim();
  if (h1 && h1.length > 3 && h1.length < 120) return cleanText(h1);

  const title = $("title").text().trim();
  if (title) {
    // Strip common site name suffixes: "Festival Name | Site Name"
    return cleanText(title.split(/[|\-–—]/)[0].trim());
  }
  return null;
}

function extractLocation($, bodyText) {
  // Look for structured microdata or meta tags first.
  const metaLocation =
    $('meta[property="og:location"]').attr("content") ||
    $('meta[name="geo.region"]').attr("content");

  if (metaLocation) {
    const parts = metaLocation.split(",").map((s) => s.trim());
    return { city: parts[0] || null, country: parts[1] || null };
  }

  // Heuristic: look for "City, Country" patterns in the first 1000 chars.
  const snippet = bodyText.slice(0, 1000);

  // "Location: Berlin, Germany" or "Venue: ..."
  const locationMatch = snippet.match(
    /(?:location|venue|city|held in|takes place in|based in)[:\s]+([A-Z][a-zA-Z\s]+),\s*([A-Z][a-zA-Z\s]+)/i
  );
  if (locationMatch) {
    return {
      city: cleanText(locationMatch[1]),
      country: cleanText(locationMatch[2]),
    };
  }

  return { city: null, country: null };
}

function extractGenre(bodyText) {
  const lower = bodyText.toLowerCase();
  for (const genre of GENRE_KEYWORDS) {
    if (lower.includes(genre)) return capitalise(genre);
  }
  return null;
}

function extractApplicationUrl($, pageUrl) {
  const base = new URL(pageUrl);
  let best = null;

  $("a[href]").each((_, el) => {
    const text = $(el).text().toLowerCase().trim();
    const href = $(el).attr("href") ?? "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;

    const isApplyLink = APPLY_LINK_KEYWORDS.some(
      (kw) => text.includes(kw) || href.toLowerCase().includes(kw)
    );
    if (!isApplyLink) return;

    try {
      const abs = new URL(href, base).href;
      // Prefer external submission platforms over same-domain links.
      const isExternal = !abs.includes(base.hostname);
      if (!best || isExternal) best = abs;
    } catch {
      // relative URL that can't be parsed — ignore.
    }
  });

  return best;
}

function extractWebsite($, pageUrl) {
  // og:url is usually the canonical page URL.
  const og = $('meta[property="og:url"]').attr("content");
  if (og) {
    try { return new URL(og).href; } catch { /* ignore */ }
  }

  // Canonical link.
  const canonical = $('link[rel="canonical"]').attr("href");
  if (canonical) {
    try { return new URL(canonical, pageUrl).href; } catch { /* ignore */ }
  }

  return pageUrl;
}

function extractSocialLinks($) {
  const platforms = {
    instagram: /instagram\.com/,
    facebook: /facebook\.com/,
    twitter: /twitter\.com|x\.com/,
    youtube: /youtube\.com/,
    soundcloud: /soundcloud\.com/,
    bandcamp: /bandcamp\.com/,
    spotify: /spotify\.com/,
    tiktok: /tiktok\.com/,
  };

  const links = {};
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    for (const [platform, re] of Object.entries(platforms)) {
      if (re.test(href) && !links[platform]) {
        links[platform] = href;
      }
    }
  });
  return links;
}

function cleanText(s) {
  return s.replace(/\s+/g, " ").trim();
}

function capitalise(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
