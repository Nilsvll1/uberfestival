/**
 * Extracts structured data from a Wikipedia festival article's infobox.
 *
 * Returns: { website, city, country, genre, festival_start_date, festival_end_date }
 * Fields that cannot be extracted are absent from the returned object.
 */

import * as cheerio from "cheerio";
import { extractDates } from "./extract-date.mjs";

// Wikipedia region/nation names that map to standard country names
const REGION_TO_COUNTRY = {
  "england":          "United Kingdom",
  "scotland":         "United Kingdom",
  "wales":            "United Kingdom",
  "northern ireland": "United Kingdom",
  "great britain":    "United Kingdom",
  "u.s.":             "United States",
  "u.s.a.":           "United States",
  "usa":              "United States",
  "us":               "United States",
  "holland":          "Netherlands",
  "the netherlands":  "Netherlands",
};

export function extractWikipediaInfobox(html, articleUrl) {
  const $ = cheerio.load(html);
  const result = {};

  // ── Infobox ────────────────────────────────────────────────────────────────
  const infobox = $("table.infobox, .infobox-table, table.vevent").first();

  if (infobox.length) {
    infobox.find("tr").each((_, row) => {
      const labelEl = $(row).find("th.infobox-label, th").first();
      const dataEl  = $(row).find("td.infobox-data, td").first();
      if (!labelEl.length || !dataEl.length) return;

      const label = labelEl.text().replace(/\[.*?\]/g, "").trim().toLowerCase();
      const text  = dataEl.text().replace(/\[.*?\]/g, "").replace(/\s+/g, " ").trim();

      if (/^location|^venue|^held at|^place/.test(label)) {
        parseLocation(text, result);

      } else if (/^genre/.test(label)) {
        const g = text.split(/[,•\n]/)[0].replace(/\[.*?\]/g, "").trim();
        if (g && g.length < 80 && !result.genre) result.genre = normaliseGenre(g);

      } else if (/^website|^official website/.test(label)) {
        const link = dataEl.find("a[href]")
          .filter((_, a) => !/^\/wiki\//.test($(a).attr("href") ?? ""))
          .first();
        const href = link.attr("href") || text;
        if (href && /^https?:\/\//.test(href) && !result.website) {
          result.website = href.trim();
        }

      } else if (/^dates?$|^when$|^timing|^schedule/.test(label)) {
        if (!result.dates_text) result.dates_text = text;

      } else if (/^founded|^established|^first held|^inception/.test(label)) {
        // Founding year — useful as a quality signal but not a date field
      }
    });
  }

  // ── Body text date extraction ──────────────────────────────────────────────
  // Only run if we don't have dates yet. Strip nav/footer/infobox to reduce noise.
  if (!result.festival_start_date) {
    $("table.infobox, nav, footer, header, aside, .navbox, .reflist").remove();
    $("script, style").remove();
    const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 5000);
    const dates = extractDates(bodyText);
    if (dates.festivalStart) result.festival_start_date = dates.festivalStart;
    if (dates.festivalEnd)   result.festival_end_date   = dates.festivalEnd;
  }

  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseLocation(text, result) {
  if (result.city && result.country) return;

  // Remove parenthetical notes like "(near Clisson)"
  const clean = text.replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim();
  const parts  = clean.split(",").map(s => s.trim()).filter(Boolean);
  if (!parts.length) return;

  const rawCountry = parts[parts.length - 1];
  const country    = REGION_TO_COUNTRY[rawCountry.toLowerCase()] || rawCountry;

  if (!result.country && country && country.length >= 3 && country.length <= 50) {
    result.country = country;
  }
  if (!result.city && parts.length >= 2) {
    const city = parts[0];
    if (city.length >= 2 && city.length <= 60) result.city = city;
  }
}

function normaliseGenre(genre) {
  return genre
    .replace(/ music$/i, "")
    .replace(/^contemporary /i, "")
    .replace(/\band\b.*/i, "")  // "Rock and pop" → "Rock"
    .trim();
}
