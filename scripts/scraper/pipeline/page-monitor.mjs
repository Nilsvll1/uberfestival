/**
 * Page Monitor — Phase A3 of the ingestion pipeline.
 *
 * Fetches each active entry in the festival_pages table and:
 *   1. Computes a SHA-256 hash of the page body.
 *   2. Skips extraction if the hash matches the stored last_hash (unchanged).
 *   3. On change: runs classifyPage → extractFestivalInfo and returns a
 *      FestivalCandidate in the same shape as rss-fetcher.mjs produces.
 *
 * This means pages only consume enrichment + DB budget when their content
 * actually changed since the last run — usually 0–5 pages per week.
 *
 * Politeness: 2 s between page fetches (festival sites, not APIs).
 */

import { createHash } from "crypto";
import { fetchPage }          from "../lib/fetch-page.mjs";
import { classifyPage }       from "../lib/classify-page.mjs";
import { extractFestivalInfo } from "../lib/extract-festival.mjs";

const PAGE_DELAY_MS = 2_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Monitors all active pages in festival_pages and returns FestivalCandidate[]
 * for pages whose content changed and passed the classifier.
 *
 * @param {import('@supabase/postgrest-js').PostgrestClient} db
 * @param {{ log: Function }}                                reporter
 * @param {string|number}                                    runId
 * @param {boolean}                                          dryRun
 * @returns {Promise<Array<{ record: object, baseConfidence: number }>>}
 */
export async function monitorFestivalPages(db, reporter, runId, dryRun = false) {
  const { data: pages, error } = await db
    .from("festival_pages")
    .select("*")
    .eq("is_active", true)
    .order("last_checked_at", { ascending: true, nullsFirst: true });

  if (error) throw new Error(`Cannot load festival_pages: ${error.message}`);
  if (!pages?.length) return [];

  console.log(`\n  [A3 Pages] Monitoring ${pages.length} curated page(s)…`);

  const candidates = [];
  let checked = 0, unchanged = 0, changed = 0, accepted = 0, errors = 0;

  for (const page of pages) {
    await sleep(PAGE_DELAY_MS);
    checked++;

    try {
      const { html, status, error: fetchErr, finalUrl } = await fetchPage(page.url, {});

      if (fetchErr || !html) {
        reporter.log(runId, "warn", "page_monitor",
          `Fetch failed for "${page.name}": ${fetchErr ?? `HTTP ${status}`}`,
          { pageId: page.id, url: page.url });
        errors++;

        if (!dryRun) {
          await db.from("festival_pages").update({
            last_checked_at: new Date().toISOString(),
          }).eq("id", page.id);
        }
        continue;
      }

      const hash = createHash("sha256").update(html).digest("hex");
      const isUnchanged = hash === page.last_hash;

      if (!dryRun) {
        await db.from("festival_pages").update({
          last_checked_at: new Date().toISOString(),
          last_hash:       hash,
        }).eq("id", page.id);
      }

      if (isUnchanged) {
        console.log(`  ✓ ${page.name}: unchanged`);
        unchanged++;
        continue;
      }

      changed++;
      console.log(`  △ ${page.name}: content changed — extracting…`);

      const extracted = extractFestivalInfo(html, finalUrl ?? page.url);

      // Curated pages are manually vetted sources — we trust them more than RSS items.
      // Use a lower threshold (25) so pages pass as long as they have any opportunity
      // signal. The classifier still blocks generic 404-redirect homepages (score 0).
      const CURATED_THRESHOLD = 25;
      const { confidence, reason } = classifyPage(finalUrl ?? page.url, extracted);
      const accept = confidence >= CURATED_THRESHOLD;

      reporter.log(runId, "info", "page_monitor",
        `"${page.name}" changed — classifier: ${accept ? "ACCEPT" : "REJECT"} (${confidence}) ${reason}`,
        { pageId: page.id, confidence, accept });

      if (!accept) {
        console.log(`    → rejected by classifier (${confidence}): ${reason}`);
        continue;
      }

      accepted++;

      if (!dryRun) {
        await db.from("festival_pages").update({
          last_open_at: new Date().toISOString(),
        }).eq("id", page.id);
      }

      candidates.push({
        record: {
          ...extracted,
          // Prefer stored name over extracted title (we curated it deliberately)
          festival_name:    extracted.festival_name ?? page.name,
          discovery_source: "page_monitor",
          source_url:       finalUrl ?? page.url,
        },
        baseConfidence: confidence / 100,
      });

    } catch (err) {
      reporter.log(runId, "error", "page_monitor",
        `Error processing "${page.name}": ${err.message}`,
        { pageId: page.id });
      errors++;
    }
  }

  console.log(
    `  [A3 Pages] ${checked} checked | ` +
    `${unchanged} unchanged | ${changed} changed | ` +
    `${accepted} accepted | ${errors} errors`
  );
  reporter.log(runId, "info", "page_monitor",
    `Page monitor complete: ${checked} checked, ${accepted} candidate(s)`,
    { checked, unchanged, changed, accepted, errors });

  return candidates;
}
