/**
 * Scrapes Wikipedia "List of music festivals in [Country]" pages.
 *
 * These pages contain wikitables with festival name, location, genre, and
 * links to each festival's Wikipedia article (which has the official website).
 *
 * Records returned have null coordinates — call geocode() on them afterwards.
 */

import * as cheerio from "cheerio";
import { fetchPage } from "../lib/fetch-page.mjs";

// ── Source list: one entry per Wikipedia list page ────────────────────────────

export const WIKIPEDIA_FESTIVAL_LISTS = [
  // ── Europe ──────────────────────────────────────────────────────────────────
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_the_United_Kingdom", country: "United Kingdom" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_France",             country: "France" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Germany",            country: "Germany" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_the_Netherlands",    country: "Netherlands" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Belgium",            country: "Belgium" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Sweden",             country: "Sweden" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Norway",             country: "Norway" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Denmark",            country: "Denmark" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Finland",            country: "Finland" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Switzerland",        country: "Switzerland" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Spain",              country: "Spain" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Portugal",           country: "Portugal" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Italy",              country: "Italy" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Croatia",            country: "Croatia" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Poland",             country: "Poland" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Ireland",            country: "Ireland" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Hungary",            country: "Hungary" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Romania",            country: "Romania" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Serbia",             country: "Serbia" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Austria",            country: "Austria" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Greece",             country: "Greece" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Latvia",             country: "Latvia" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Lithuania",          country: "Lithuania" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Estonia",            country: "Estonia" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Ukraine",            country: "Ukraine" },

  // ── North America ────────────────────────────────────────────────────────────
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_the_United_States",  country: "United States" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Canada",             country: "Canada" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Mexico",             country: "Mexico" },

  // ── South America ────────────────────────────────────────────────────────────
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Brazil",             country: "Brazil" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Argentina",          country: "Argentina" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Colombia",           country: "Colombia" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Chile",              country: "Chile" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Peru",               country: "Peru" },

  // ── Asia ─────────────────────────────────────────────────────────────────────
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Japan",              country: "Japan" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_South_Korea",        country: "South Korea" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_India",              country: "India" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Thailand",           country: "Thailand" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Israel",             country: "Israel" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Turkey",             country: "Turkey" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Indonesia",          country: "Indonesia" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_China",              country: "China" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Taiwan",             country: "Taiwan" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Singapore",          country: "Singapore" },

  // ── Africa ───────────────────────────────────────────────────────────────────
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_South_Africa",       country: "South Africa" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Nigeria",            country: "Nigeria" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Morocco",            country: "Morocco" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Ghana",              country: "Ghana" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Kenya",              country: "Kenya" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Tanzania",           country: "Tanzania" },

  // ── Oceania ──────────────────────────────────────────────────────────────────
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_Australia",          country: "Australia" },
  { url: "https://en.wikipedia.org/wiki/List_of_music_festivals_in_New_Zealand",        country: "New Zealand" },

  // ── Genre-specific global lists ───────────────────────────────────────────────
  { url: "https://en.wikipedia.org/wiki/List_of_jazz_festivals",                        country: null },
  { url: "https://en.wikipedia.org/wiki/List_of_electronic_music_festivals",            country: null },
  { url: "https://en.wikipedia.org/wiki/List_of_rock_music_festivals",                  country: null },
  { url: "https://en.wikipedia.org/wiki/List_of_folk_music_festivals",                  country: null },
  { url: "https://en.wikipedia.org/wiki/List_of_classical_music_festivals",             country: null },
  { url: "https://en.wikipedia.org/wiki/List_of_world_music_festivals",                 country: null },
];

// ── Scraper ───────────────────────────────────────────────────────────────────

/**
 * Fetches and parses one Wikipedia festival list page.
 * @param {{ url: string, country: string|null }} source
 * @returns {Promise<object[]>}
 */
export async function fetchWikipediaFestivalList(source) {
  const { html, error } = await fetchPage(source.url);
  if (!html) {
    console.log(`  wikipedia: fetch failed ${source.url} — ${error}`);
    return [];
  }
  const festivals = parseWikipediaFestivalList(html, source.url, source.country);
  console.log(`  wikipedia: ${festivals.length} festivals from ${source.url}`);
  return festivals;
}

// ── Parser ────────────────────────────────────────────────────────────────────

// Headings that are navigation/meta sections — don't use as genre labels
const SKIP_HEADINGS = new Set([
  "see also", "notes", "references", "bibliography", "external links",
  "further reading", "footnotes", "history", "events", "overview",
  "contents", "sources",
]);

function parseWikipediaFestivalList(html, pageUrl, countryHint) {
  const $ = cheerio.load(html);

  // ── Format A: wikitable (used by genre-specific global lists) ───────────────
  if ($("table.wikitable").length) {
    return parseWikitable($, pageUrl, countryHint);
  }

  // ── Format B: genre-heading + UL list (used by most country pages) ──────────
  return parseHeadingList($, pageUrl, countryHint);
}

function parseWikitable($, pageUrl, countryHint) {
  const results = [];

  $("table.wikitable").each((_, table) => {
    const headers = [];
    $(table).find("tr").first().find("th").each((_, th) => {
      headers.push($(th).text().trim().toLowerCase().replace(/[\[\]\d]/g, "").trim());
    });

    const nameIdx     = bestIdx(headers, ["festival", "name", "festival name"]);
    const locationIdx = bestIdx(headers, ["location", "city", "place", "venue", "held at", "held in", "based in", "country"]);
    const genreIdx    = bestIdx(headers, ["genre", "music genre", "style", "type"]);

    $(table).find("tr").slice(1).each((_, row) => {
      const cells = $(row).find("td");
      if (!cells.length) return;

      const nameCell = cells.eq(nameIdx >= 0 ? nameIdx : 0);
      const anchor   = nameCell.find("a[href^='/wiki/']").first();
      const rawName  = (anchor.text().trim() || nameCell.text().trim())
        .replace(/\s+/g, " ").replace(/\[.*?\]/g, "").trim();
      if (!rawName || rawName.length < 3 || rawName.length > 200) return;

      const wikiHref = anchor.attr("href") ?? null;
      const wikiUrl  = wikiHref ? `https://en.wikipedia.org${wikiHref}` : null;

      let city = null, country = countryHint ?? null;
      if (locationIdx >= 0) {
        const locRaw = cells.eq(locationIdx).text().replace(/\[.*?\]/g, "").replace(/\s+/g, " ").trim();
        if (locRaw) {
          const parts = locRaw.split(",").map(s => s.trim()).filter(Boolean);
          if (parts[0]?.length <= 60) city = parts[0];
          if (!country && parts.length >= 2) {
            const last = parts[parts.length - 1];
            if (last.length >= 3 && last.length <= 40) country = last;
          }
        }
      }

      let genre = null;
      if (genreIdx >= 0) {
        const g = cells.eq(genreIdx).text().replace(/\[.*?\]/g, "").split(/[,;\/]/)[0].trim();
        if (g && g.length <= 80) genre = g;
      }

      results.push(makeRecord(rawName, country, city, genre, wikiUrl ?? pageUrl, wikiUrl));
    });
  });

  return results;
}

function parseHeadingList($, pageUrl, countryHint) {
  const results = [];
  const content = $("#mw-content-text");
  let currentGenre = null;

  content.find("h2, h3, h4, ul").each((_, el) => {
    const tag = el.tagName;

    if (tag === "h2" || tag === "h3" || tag === "h4") {
      const heading = $(el).text().replace(/\[.*?\]/g, "").trim().toLowerCase();
      currentGenre = SKIP_HEADINGS.has(heading) ? null : capitalise(heading);
      return;
    }

    if (tag !== "ul" || !currentGenre) return;

    $(el).children("li").each((_, li) => {
      const anchor  = $(li).find("a[href^='/wiki/']").first();
      const rawName = (anchor.text().trim() || $(li).text().trim())
        .replace(/\[.*?\]/g, "").replace(/\s+/g, " ").trim();

      if (!rawName || rawName.length < 3 || rawName.length > 200) return;

      const wikiHref = anchor.attr("href") ?? null;
      // Skip links to Wikipedia meta-pages, categories, files
      if (wikiHref && /^\/wiki\/(Wikipedia|Category|File|Help|Special):/.test(wikiHref)) return;
      const wikiUrl = wikiHref ? `https://en.wikipedia.org${wikiHref}` : null;

      results.push(makeRecord(rawName, countryHint ?? null, null, currentGenre, wikiUrl ?? pageUrl, wikiUrl));
    });
  });

  return results;
}

function makeRecord(name, country, city, genre, sourceUrl, wikiUrl) {
  return {
    festival_name:       name,
    country:             country ?? null,
    city:                city    ?? null,
    genre:               genre   ?? null,
    official_website:    null,
    festival_start_date: null,
    festival_end_date:   null,
    latitude:            null,
    longitude:           null,
    source_url:          sourceUrl,
    source:              "wikipedia",
    _wiki_url:           wikiUrl,
  };
}

function bestIdx(headers, keywords) {
  for (const kw of keywords) {
    const i = headers.findIndex(h => h === kw || h.includes(kw));
    if (i >= 0) return i;
  }
  return -1;
}

function capitalise(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
