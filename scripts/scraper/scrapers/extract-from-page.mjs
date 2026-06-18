/**
 * Extracts festival data from an individual festival page.
 *
 * This is a lightweight extractor for festival directory pages — it looks
 * for structured data (JSON-LD, microdata, og: tags) and basic text signals.
 * It does NOT look for grants, open calls, or application deadlines.
 */

import * as cheerio from "cheerio";
import { extractDates } from "../lib/extract-date.mjs";

const ISO2_COUNTRY = {
  AF:"Afghanistan", AL:"Albania", DZ:"Algeria", AR:"Argentina", AU:"Australia",
  AT:"Austria", BE:"Belgium", BR:"Brazil", CA:"Canada", CL:"Chile", CN:"China",
  CO:"Colombia", HR:"Croatia", CZ:"Czech Republic", DK:"Denmark", EG:"Egypt",
  FI:"Finland", FR:"France", DE:"Germany", GH:"Ghana", GR:"Greece", HU:"Hungary",
  IN:"India", ID:"Indonesia", IE:"Ireland", IL:"Israel", IT:"Italy", JP:"Japan",
  KE:"Kenya", KR:"South Korea", MX:"Mexico", MA:"Morocco", NL:"Netherlands",
  NZ:"New Zealand", NG:"Nigeria", NO:"Norway", PH:"Philippines", PL:"Poland",
  PT:"Portugal", RO:"Romania", RS:"Serbia", SG:"Singapore", SI:"Slovenia",
  ZA:"South Africa", ES:"Spain", SE:"Sweden", CH:"Switzerland", TH:"Thailand",
  TR:"Turkey", UA:"Ukraine", GB:"United Kingdom", US:"United States",
};

const GENRE_KEYWORDS = [
  "jazz", "electronic", "classical", "folk", "rock", "pop", "hip-hop", "hiphop",
  "world music", "world", "blues", "country", "metal", "indie", "ambient",
  "reggae", "soul", "r&b", "dance", "techno", "house", "drum and bass",
  "punk", "alternative", "afrobeat", "latin", "gospel", "funk", "disco",
];

export function extractFestivalFromPage(html, pageUrl) {
  const $ = cheerio.load(html);
  $("style, nav, footer, aside").remove();
  $("script:not([type='application/ld+json'])").remove();

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const jsonLd   = extractJsonLd($);
  const title    = extractTitle($);
  const dates    = extractDates(bodyText);
  const geo      = extractGeo($, pageUrl, jsonLd);
  const genre    = extractGenre(bodyText, title);
  const website  = extractWebsite($, pageUrl);
  const coords   = jsonLd.coords ?? null;

  return {
    festival_name:       title || null,
    country:             geo.country || null,
    city:                geo.city    || null,
    genre:               genre       || null,
    official_website:    website     || null,
    festival_start_date: jsonLd.startDate || dates.festivalStart || null,
    festival_end_date:   jsonLd.endDate   || dates.festivalEnd   || null,
    latitude:            coords?.lat ?? null,
    longitude:           coords?.lng ?? null,
    source_url:          pageUrl,
  };
}

// ── JSON-LD ───────────────────────────────────────────────────────────────────

function extractJsonLd($) {
  const result = {
    city: null, country: null, startDate: null, endDate: null, coords: null,
  };

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      let data = JSON.parse($(el).html() ?? "");
      if (Array.isArray(data)) data = data[0];
      if (!data || typeof data !== "object") return;

      const type = String(data["@type"] ?? "");
      if (!/MusicEvent|Event|Festival|MusicFestival/i.test(type)) return;

      const loc = data.location;
      if (loc) {
        const addr = typeof loc === "string" ? null : loc.address;
        if (addr) {
          result.city    = clean(addr.addressLocality ?? addr.addressRegion);
          result.country = clean(addr.addressCountry);
        } else if (loc.name) {
          const parts = String(loc.name).split(",").map(s => s.trim());
          result.city    = clean(parts[0]);
          result.country = clean(parts[parts.length - 1]);
        }
        // Coordinates from geo
        const geo = loc.geo;
        if (geo?.latitude != null && geo?.longitude != null) {
          result.coords = { lat: parseFloat(geo.latitude), lng: parseFloat(geo.longitude) };
        }
      }
      if (data.startDate) result.startDate = String(data.startDate).slice(0, 10);
      if (data.endDate)   result.endDate   = String(data.endDate).slice(0, 10);
    } catch { /* malformed */ }
  });

  return result;
}

// ── Title ─────────────────────────────────────────────────────────────────────

function extractTitle($) {
  const h1 = $("h1").first().text().trim();
  if (h1 && h1.length > 3 && h1.length < 120) return h1.replace(/\s+/g, " ");

  const og = $('meta[property="og:title"]').attr("content")?.trim();
  if (og && og.length > 3) return og.split(/[|\-–—]/)[0].trim().replace(/\s+/g, " ");

  const title = $("title").text().trim();
  return title ? title.split(/[|\-–—]/)[0].trim().replace(/\s+/g, " ") : null;
}

// ── Geo ───────────────────────────────────────────────────────────────────────

function extractGeo($, pageUrl, jsonLd) {
  if (jsonLd.city || jsonLd.country) {
    return { city: jsonLd.city, country: jsonLd.country };
  }

  // Microdata
  const mdCity = clean(
    $('[itemprop="addressLocality"]').first().attr("content") ||
    $('[itemprop="addressLocality"]').first().text()
  );
  const mdCountry = clean(
    $('[itemprop="addressCountry"]').first().attr("content") ||
    $('[itemprop="addressCountry"]').first().text()
  );
  if (mdCity || mdCountry) return { city: mdCity, country: mdCountry };

  // OpenGraph / geo meta
  const geoRegion = $('meta[name="geo.region"]').attr("content") ?? "";
  if (geoRegion) {
    const code = geoRegion.split("-")[0].toUpperCase();
    const country = ISO2_COUNTRY[code] ?? null;
    if (country) return { city: null, country };
  }

  const ogCountry = clean($('meta[property="og:country-name"]').attr("content"));
  if (ogCountry) return { city: null, country: ogCountry };

  // ccTLD
  try {
    const hostname = new URL(pageUrl).hostname;
    const TLD_COUNTRY = {
      ".de": "Germany", ".fr": "France", ".ie": "Ireland", ".nl": "Netherlands",
      ".be": "Belgium", ".at": "Austria", ".ch": "Switzerland", ".it": "Italy",
      ".es": "Spain", ".pt": "Portugal", ".se": "Sweden", ".no": "Norway",
      ".dk": "Denmark", ".fi": "Finland", ".pl": "Poland", ".cz": "Czech Republic",
      ".au": "Australia", ".nz": "New Zealand", ".ca": "Canada", ".br": "Brazil",
      ".jp": "Japan", ".kr": "South Korea", ".in": "India", ".za": "South Africa",
    };
    const match = Object.entries(TLD_COUNTRY).find(([tld]) => hostname.endsWith(tld));
    if (match) return { city: null, country: match[1] };
  } catch { /* ignore */ }

  return { city: null, country: null };
}

// ── Genre ─────────────────────────────────────────────────────────────────────

function extractGenre(bodyText, title) {
  const combined = ((title ?? "") + " " + bodyText).toLowerCase();
  for (const genre of GENRE_KEYWORDS) {
    if (combined.includes(genre)) {
      return genre.charAt(0).toUpperCase() + genre.slice(1);
    }
  }
  return null;
}

// ── Website ───────────────────────────────────────────────────────────────────

function extractWebsite($, pageUrl) {
  const og = $('meta[property="og:url"]').attr("content");
  if (og) { try { return new URL(og).href; } catch { /* ignore */ } }
  const canonical = $('link[rel="canonical"]').attr("href");
  if (canonical) { try { return new URL(canonical, pageUrl).href; } catch { /* ignore */ } }
  return pageUrl;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clean(v) {
  if (!v || typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length > 60 || s.split(/\s+/).length > 4) return null;
  return s;
}
