/**
 * UberFestival RSS Ingestion Pipeline — main entry point.
 *
 * Four-phase execution:
 *
 *   Phase A — Discovery
 *     A1. Start a pipeline_runs record
 *     A2. RSS feeds: fetch → parse → extract candidates
 *     A3. Page monitor: fetch curated festival pages, diff hash, extract on change
 *     Deduplicate all candidates against the existing festival index
 *     Result: two arrays — newCandidates, updateCandidates (all in-memory)
 *
 *   Phase B — Enrichment
 *     5. Geocode all new candidates that have a city or country
 *     6. HEAD-probe application URLs to verify they are live
 *
 *   Phase C — Quality Scoring
 *     7. Re-score confidence after enrichment
 *        Base score (Phase A) + geocoding bonus + live-URL bonus
 *
 *   Phase D — Publishing
 *     8. New candidates: confidence ≥ 0.65 → festivals table
 *                        confidence < 0.65 → festival_staging (admin review)
 *     9. Update candidates: field-level merge (deadline, URL, description, etc.)
 *    10. Archive stale festivals
 *    11. Complete the pipeline_runs record
 *
 * Usage:
 *   node --env-file=.env pipeline/run.mjs
 *   node --env-file=.env pipeline/run.mjs --dry-run
 *   node --env-file=.env pipeline/run.mjs --feed-id=3
 *   node --env-file=.env pipeline/run.mjs --skip-archive
 *   node --env-file=.env pipeline/run.mjs --skip-pages
 *   node --env-file=.env pipeline/run.mjs --skip-festhome
 *   node --env-file=.env pipeline/run.mjs --skip-links
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { db }                     from "../lib/supabase.mjs";
import { fetchFeed }              from "./rss-fetcher.mjs";
import { extractFestivalFromItem } from "./extractor.mjs";
import { buildFestivalIndex }     from "./deduplicator.mjs";
import { enrichBatch, rescoreAfterEnrichment } from "./enricher.mjs";
import { createFestival, updateFestival } from "./updater.mjs";
import { archiveStale }           from "./archiver.mjs";
import { createReporter }         from "./reporter.mjs";
import { monitorFestivalPages }   from "./page-monitor.mjs";
import { scrapeFesthome }         from "./festhome-scraper.mjs";
import { validateApplicationLinks } from "./link-validator.mjs";

// ── CLI args ──────────────────────────────────────────────────────────────────
const args         = process.argv.slice(2);
const DRY_RUN      = args.includes("--dry-run");
const FEED_ID      = parseInt(args.find((a) => a.startsWith("--feed-id="))?.split("=")[1] ?? "0", 10);
const SKIP_ARCHIVE = args.includes("--skip-archive");
const SKIP_PAGES    = args.includes("--skip-pages");
const SKIP_FESTHOME = args.includes("--skip-festhome");
const SKIP_LINKS    = args.includes("--skip-links");

// Politeness: wait between feed fetches so we don't hammer source servers
const FEED_DELAY_MS = 1_500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Main ─────────────────────────────────────────────────────────────────────

const startedAt = Date.now();
console.log(`\n${"═".repeat(64)}`);
console.log(`  UberFestival RSS Pipeline — ${new Date().toISOString()}`);
if (DRY_RUN) console.log("  *** DRY RUN — no DB writes ***");
console.log(`${"═".repeat(64)}\n`);

const reporter = createReporter(db);
let runId;

try {
  runId = await reporter.start();

  // ════════════════════════════════════════════════════════════════
  // PHASE A — DISCOVERY
  // ════════════════════════════════════════════════════════════════
  console.log("── Phase A: Discovery");

  // Load active RSS feeds
  let feedQuery = db.from("rss_feeds").select("*").eq("is_active", true);
  if (FEED_ID) feedQuery = feedQuery.eq("id", FEED_ID);

  const { data: feeds, error: feedsError } = await feedQuery;
  if (feedsError) throw new Error(`Cannot load feeds: ${feedsError.message}`);

  if (!feeds?.length) {
    reporter.log(runId, "warn", "pipeline", "No active RSS feeds found — nothing to do");
    await reporter.complete(runId, emptyStats(startedAt));
    process.exit(0);
  }

  console.log(`  Loaded ${feeds.length} active feed(s)`);

  // Build deduplication index once (1 DB query → all matches in-process)
  const index = await buildFestivalIndex(db);

  // Per-feed fetch tracking
  const feedMeta = [];   // { feedId, itemsFound, error }

  // Accumulated candidate lists
  const newCandidates    = [];   // { record, baseConfidence }
  const updateCandidates = [];   // { existingId, existing, record }

  let totalItemsFound = 0;

  for (const feed of feeds) {
    console.log(`\n  [Feed] ${feed.name}`);
    console.log(`         ${feed.url}`);

    const { items, feedTitle, error: fetchErr } = await fetchFeed(feed.url);
    const meta = { feedId: feed.id, itemsFound: 0, error: fetchErr ?? null };

    if (fetchErr) {
      reporter.log(runId, "error", "feed_fetch", `Failed: ${fetchErr}`, { feedId: feed.id, url: feed.url });
      feedMeta.push(meta);
      await sleep(FEED_DELAY_MS);
      continue;
    }

    if (!items.length) {
      reporter.log(runId, "warn", "feed_fetch", "Feed returned 0 items", { feedId: feed.id });
      feedMeta.push(meta);
      await sleep(FEED_DELAY_MS);
      continue;
    }

    reporter.log(runId, "info", "feed_fetch",
      `Fetched ${items.length} item(s) from "${feedTitle || feed.name}"`,
      { feedId: feed.id, count: items.length });

    meta.itemsFound = items.length;
    totalItemsFound += items.length;

    let feedNew = 0, feedUpdate = 0, feedSkip = 0;

    for (const item of items) {
      try {
        const { record, confidence: baseConfidence, skipReason } = extractFestivalFromItem(item);

        if (!record) {
          feedSkip++;
          continue;
        }

        const { match, score, reason } = index.findMatch(record);

        if (match) {
          updateCandidates.push({ existingId: match.id, existing: match, record });
          feedUpdate++;
        } else {
          newCandidates.push({ record, baseConfidence });
          feedNew++;
        }
      } catch (err) {
        reporter.log(runId, "error", "item_error", `Error extracting "${item.title}": ${err.message}`, { feedId: feed.id });
      }
    }

    console.log(`         → ${feedNew} new, ${feedUpdate} updates, ${feedSkip} skipped`);
    feedMeta.push(meta);

    // Update feed status in DB
    if (!DRY_RUN) {
      await db.from("rss_feeds").update({
        last_fetched_at:   new Date().toISOString(),
        last_fetch_status: meta.error ? "failed" : meta.itemsFound === 0 ? "empty" : "ok",
        items_last_run:    meta.itemsFound,
      }).eq("id", feed.id);
    }

    await sleep(FEED_DELAY_MS);
  }

  // ── Source A2: Festhome open-call scraper ────────────────────────────────
  if (!SKIP_FESTHOME) {
    console.log(`\n── Phase A2: Festhome scraper`);
    const festhomeCandidates = await scrapeFesthome(index, reporter, runId, DRY_RUN);

    for (const { record, baseConfidence } of festhomeCandidates) {
      const { match } = index.findMatch(record);
      if (match) {
        updateCandidates.push({ existingId: match.id, existing: match, record });
      } else {
        newCandidates.push({ record, baseConfidence });
      }
    }
  }

  // ── Source A3: Curated festival page monitor ──────────────────────────────
  if (!SKIP_PAGES) {
    console.log(`\n── Phase A3: Curated page monitor`);
    const pageCandidates = await monitorFestivalPages(db, reporter, runId, DRY_RUN);

    for (const { record, baseConfidence } of pageCandidates) {
      const { match } = index.findMatch(record);
      if (match) {
        updateCandidates.push({ existingId: match.id, existing: match, record });
      } else {
        newCandidates.push({ record, baseConfidence });
      }
    }
  }

  console.log(`\n  Discovery complete: ${newCandidates.length} new, ${updateCandidates.length} updates`);
  reporter.log(runId, "info", "phase_a",
    `Discovery: ${newCandidates.length} new candidates, ${updateCandidates.length} updates`,
    { totalItemsFound });

  // ════════════════════════════════════════════════════════════════
  // PHASE B — ENRICHMENT
  // ════════════════════════════════════════════════════════════════
  // Extract just the records for enrichment, then put them back
  const recordsToEnrich = newCandidates.map((c) => c.record);
  await enrichBatch(recordsToEnrich, reporter);
  // (records are mutated in-place; newCandidates[i].record is the same object)

  reporter.log(runId, "info", "phase_b",
    `Enrichment complete for ${newCandidates.length} new candidate(s)`);

  // ════════════════════════════════════════════════════════════════
  // PHASE C — QUALITY SCORING
  // ════════════════════════════════════════════════════════════════
  console.log(`\n── Phase C: Quality Scoring`);

  for (const candidate of newCandidates) {
    candidate.finalConfidence = rescoreAfterEnrichment(candidate.record, candidate.baseConfidence);
  }

  const aboveThreshold = newCandidates.filter((c) => c.finalConfidence >= 0.65).length;
  const belowThreshold = newCandidates.length - aboveThreshold;
  console.log(`  Above threshold (≥0.65): ${aboveThreshold} → live publish`);
  console.log(`  Below threshold (<0.65): ${belowThreshold} → staging queue`);

  reporter.log(runId, "info", "phase_c",
    `Scored ${newCandidates.length} candidates: ${aboveThreshold} live, ${belowThreshold} staging`);

  // ════════════════════════════════════════════════════════════════
  // PHASE D — PUBLISHING
  // ════════════════════════════════════════════════════════════════
  console.log(`\n── Phase D: Publishing`);

  const stats = {
    feedsProcessed:    feedMeta.filter((m) => !m.error).length,
    itemsFound:        totalItemsFound,
    festivalsCreated:  0,
    festivalsUpdated:  0,
    festivalsArchived: 0,
    errorsCount:       feedMeta.filter((m) => m.error).length,
    feedBreakdown:     feedMeta,
  };

  // Publish new candidates
  for (const { record, finalConfidence } of newCandidates) {
    try {
      if (DRY_RUN) {
        stats.festivalsCreated++;
        console.log(`  [dry] New: ${record.festival_name} (conf=${finalConfidence.toFixed(2)})`);
        continue;
      }
      const outcome = await createFestival(record, finalConfidence, db);
      if (outcome === "created_live") {
        stats.festivalsCreated++;
        reporter.log(runId, "info", "festival_created",
          `Published: "${record.festival_name}" (conf=${finalConfidence.toFixed(2)})`,
          { country: record.country, deadline: record.submission_deadline, confidence: finalConfidence });
        // Add to index to prevent duplicates within the same run
        index.festivals.push(record);
      } else if (outcome === "created_staging") {
        reporter.log(runId, "info", "festival_staged",
          `Staged: "${record.festival_name}" (conf=${finalConfidence.toFixed(2)})`,
          { country: record.country, confidence: finalConfidence });
        stats.festivalsCreated++;
      }
      // "skipped" = unique violation, already in DB despite not matching index — ignore
    } catch (err) {
      reporter.log(runId, "error", "publish_error",
        `Failed to publish "${record.festival_name}": ${err.message}`);
      stats.errorsCount++;
    }
  }

  // Apply updates
  for (const { existingId, existing, record } of updateCandidates) {
    try {
      if (DRY_RUN) {
        stats.festivalsUpdated++;
        console.log(`  [dry] Update id=${existingId}: ${record.festival_name}`);
        continue;
      }
      const changed = await updateFestival(existingId, existing, record, db);
      if (changed) {
        stats.festivalsUpdated++;
        reporter.log(runId, "info", "festival_updated",
          `Updated id=${existingId}: "${record.festival_name}"`);
      }
    } catch (err) {
      reporter.log(runId, "error", "update_error",
        `Failed to update festival ${existingId}: ${err.message}`);
      stats.errorsCount++;
    }
  }

  // Archive stale festivals
  if (!SKIP_ARCHIVE && !DRY_RUN) {
    console.log(`\n── Archiving stale festivals`);
    const archived = await archiveStale(db);
    stats.festivalsArchived = archived;
    reporter.log(runId, "info", "archive", `Archived ${archived} stale festival(s)`);
  }

  // ════════════════════════════════════════════════════════════════
  // PHASE E — APPLICATION LINK VALIDATION
  // ════════════════════════════════════════════════════════════════
  if (!SKIP_LINKS) {
    try {
      const { checked, broken, recovered } = await validateApplicationLinks(
        db, reporter, runId, DRY_RUN,
        { limit: 150, concurrency: 3 },
      );
      stats.linksChecked  = checked;
      stats.linksBroken   = broken;
      stats.linksRecovered = recovered;
    } catch (err) {
      reporter.log(runId, "error", "phase_e", `Link validation failed: ${err.message}`);
      stats.errorsCount++;
    }
  }

  // ── Complete run ──────────────────────────────────────────────────────────
  stats.durationMs = Date.now() - startedAt;

  if (DRY_RUN) {
    console.log("\n[dry-run] Final stats:", JSON.stringify(stats, null, 2));
  } else {
    await reporter.complete(runId, stats);
  }

  const dur = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n${"═".repeat(64)}`);
  console.log(`  Done in ${dur}s`);
  console.log(`  Created: ${stats.festivalsCreated}  Updated: ${stats.festivalsUpdated}  Archived: ${stats.festivalsArchived}  Errors: ${stats.errorsCount}`);
  if (!SKIP_LINKS) {
    console.log(`  Links checked: ${stats.linksChecked ?? 0}  Broken: ${stats.linksBroken ?? 0}  Recovered: ${stats.linksRecovered ?? 0}`);
  }
  console.log(`${"═".repeat(64)}\n`);

  process.exit(0);

} catch (err) {
  console.error("\n[pipeline] FATAL:", err.message);
  if (runId) await reporter.fail(runId, err).catch(() => {});
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyStats(startedAt) {
  return {
    feedsProcessed: 0, itemsFound: 0, festivalsCreated: 0,
    festivalsUpdated: 0, festivalsArchived: 0, errorsCount: 0,
    durationMs: Date.now() - startedAt,
  };
}
