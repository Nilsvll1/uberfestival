/**
 * Festhome scraper — Phase A2 of the ingestion pipeline.
 *
 * Festhome (festhome.com) is a public film festival directory with server-rendered
 * HTML and no login requirement. The /festivals?open=1 listing shows ~80 festivals
 * currently accepting submissions on a single page.
 *
 * Strategy:
 *   1. Fetch the listing page to get festival IDs + names (~80 entries, no pagination)
 *   2. Cross-reference each against the existing festival index
 *   3. For festivals NOT already in our DB, fetch the detail page
 *   4. Extract structured data via the existing extractFestivalInfo() (JSON-LD + HTML)
 *   5. Classify and return candidates in the standard pipeline format
 *
 * Rate limiting: 2 s between detail-page fetches. Max 20 new detail fetches per run
 * so the total wall time stays under ~50 s even in a cold run.
 */

import * as cheerio from "cheerio";
import { fetchPage }          from "../lib/fetch-page.mjs";
import { classifyPage }       from "../lib/classify-page.mjs";
import { extractFestivalInfo } from "../lib/extract-festival.mjs";

const LISTING_URL      = "https://festhome.com/festivals?open=1";
const BASE_URL         = "https://festhome.com";
const PAGE_DELAY_MS    = 2_000;
const MAX_NEW_PER_RUN  = 20;   // cap detail-page fetches to stay polite
const CURATED_THRESHOLD = 25;  // same as page-monitor (trusted source)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Scrapes open festival listings from Festhome.
 *
 * @param {{ findMatch: Function }} index   — festival deduplication index
 * @param {{ log: Function }}       reporter
 * @param {string|number}           runId
 * @param {boolean}                 dryRun
 * @returns {Promise<Array<{ record: object, baseConfidence: number }>>}
 */
export async function scrapeFesthome(index, reporter, runId, dryRun = false) {
  console.log(`\n  [A2 Festhome] Fetching listing…`);

  // ── Step 1: fetch listing page ────────────────────────────────────────────
  const { html: listingHtml, error: listingErr } = await fetchPage(LISTING_URL, {});
  if (listingErr || !listingHtml) {
    reporter.log(runId, "warn", "festhome",
      `Listing fetch failed: ${listingErr ?? "no HTML"}`,
      { url: LISTING_URL });
    return [];
  }

  // ── Step 2: extract festival IDs + names from listing cards ───────────────
  // Cards use onclick="OpenViewer(7222,...)" not a standard <a href>.
  // Each card div with .festival-card contains both the ID in onclick and
  // the festival name in .festival-card-title.
  const $ = cheerio.load(listingHtml);
  const listingEntries = [];
  const seenIds = new Set();

  $(".festival-card[onclick]").each((_, cardEl) => {
    const onclick = $(cardEl).attr("onclick") ?? "";
    const idMatch = onclick.match(/OpenViewer\((\d+)/);
    if (!idMatch || seenIds.has(idMatch[1])) return;
    seenIds.add(idMatch[1]);

    const name = $(cardEl).find(".festival-card-title").text().trim();
    if (!name) return;

    // Location from globe icon title: "International Festival\n{city} {country}"
    const globeTitle = $(cardEl).find(".festival-card-outer-icon")
      .filter((_, el) => $(el).find(".fa-globe").length > 0)
      .first().attr("title") ?? "";
    const locationLine = globeTitle.split(/<br\s*\/?>|\n/).slice(1).join(" ").trim();
    const locationParts = locationLine.split(/\s+/).filter(Boolean);
    const country = locationParts.length > 0 ? locationParts[locationParts.length - 1] : null;
    const city    = locationParts.length > 1 ? locationParts.slice(0, -1).join(" ")    : null;

    listingEntries.push({
      festhomeId: idMatch[1],
      name,
      country: country || null,
      city:    city    || null,
    });
  });

  console.log(`  [A2 Festhome] ${listingEntries.length} open festivals on listing page`);

  // ── Step 3: filter to festivals not already in our index ─────────────────
  const newEntries = listingEntries
    .filter(({ name }) => {
      const { match } = index.findMatch({ festival_name: name });
      return !match;
    })
    .slice(0, MAX_NEW_PER_RUN);

  const skipped = listingEntries.length - Math.min(listingEntries.length, newEntries.length +
    (listingEntries.length - listingEntries.filter(({ name }) => !index.findMatch({ festival_name: name }).match).length));

  console.log(`  [A2 Festhome] ${newEntries.length} new (not in index), fetching detail pages…`);

  reporter.log(runId, "info", "festhome",
    `Listing: ${listingEntries.length} open, ${newEntries.length} new to process`,
    { total: listingEntries.length, new: newEntries.length });

  // ── Step 4: fetch detail pages for new festivals ──────────────────────────
  const candidates = [];
  let accepted = 0, rejected = 0, errors = 0;

  for (const entry of newEntries) {
    await sleep(PAGE_DELAY_MS);

    const url = `${BASE_URL}/festival/${entry.festhomeId}`;

    try {
      const { html: detailHtml, error: detailErr, finalUrl } = await fetchPage(url, {});

      if (detailErr || !detailHtml) {
        reporter.log(runId, "warn", "festhome",
          `Detail fetch failed for "${entry.name}": ${detailErr}`,
          { festhomeId: entry.festhomeId });
        errors++;
        continue;
      }

      const extracted = extractFestivalInfo(detailHtml, finalUrl ?? url);

      // Festhome detail pages always have Event JSON-LD — use a lower threshold
      const { confidence, reason } = classifyPage(finalUrl ?? url, extracted);
      const accept = confidence >= CURATED_THRESHOLD;

      if (!accept) {
        console.log(`    ✗ ${entry.name} (${confidence}): ${reason}`);
        rejected++;
        continue;
      }

      console.log(`    ✓ ${entry.name} (${(confidence / 100).toFixed(2)})`);
      accepted++;

      candidates.push({
        record: {
          ...extracted,
          festival_name:    extracted.festival_name ?? entry.name,
          country:          extracted.country ?? entry.country,
          city:             extracted.city    ?? entry.city,
          discovery_source: "festhome",
          source_url:       finalUrl ?? url,
        },
        baseConfidence: confidence / 100,
      });

    } catch (err) {
      reporter.log(runId, "error", "festhome",
        `Error processing "${entry.name}": ${err.message}`,
        { festhomeId: entry.festhomeId });
      errors++;
    }
  }

  console.log(
    `  [A2 Festhome] Done: ${accepted} accepted, ${rejected} rejected, ${errors} errors`
  );
  reporter.log(runId, "info", "festhome",
    `Festhome complete: ${accepted} candidate(s) from ${newEntries.length} new festivals`,
    { accepted, rejected, errors });

  return candidates;
}
