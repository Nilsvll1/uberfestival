/**
 * update-existing.mjs
 *
 * Visits the application_url / website of every festival that hasn't been
 * checked in the last 7 days and refreshes deadline + date fields.
 *
 * Batches requests 5 at a time with a 1-second pause between batches to
 * stay polite to festival servers.
 */

import * as cheerio from "cheerio";
import { db } from "../lib/supabase.mjs";
import { fetchPage } from "../lib/fetch-page.mjs";
import { extractDates } from "../lib/extract-date.mjs";

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1000;
const STALE_DAYS = 7;

export async function updateExisting() {
  const staleDate = new Date(Date.now() - STALE_DAYS * 86_400_000).toISOString();

  const { data: festivals, error } = await db
    .from("festivals")
    .select("id, festival_name, application_url, website")
    .or(`last_scraped_at.is.null,last_scraped_at.lt.${staleDate}`)
    .not("application_url", "is", null)
    .order("last_scraped_at", { ascending: true, nullsFirst: true })
    .limit(200); // cap per run; the rest gets picked up next week

  if (error) throw new Error(`Failed to load festivals: ${error.message}`);
  if (!festivals?.length) {
    console.log("update-existing: nothing stale.");
    return;
  }

  console.log(`update-existing: processing ${festivals.length} festivals.`);

  let updated = 0, failed = 0, noChange = 0;

  for (let i = 0; i < festivals.length; i += BATCH_SIZE) {
    const batch = festivals.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((f) => processOne(f)));
    if (i + BATCH_SIZE < festivals.length) await sleep(BATCH_DELAY_MS);
  }

  console.log(`update-existing: done. updated=${updated} failed=${failed} no_change=${noChange}`);

  // ── per-festival handler ───────────────────────────────────────────────────
  async function processOne(festival) {
    const url = festival.application_url || festival.website;
    if (!url) return;

    const { html, status, error: fetchError } = await fetchPage(url);

    if (!html) {
      const isDead = status === 404 || status === 410 || status === 0;
      await db.from("festivals").update({
        last_scraped_at: new Date().toISOString(),
        scrape_status: isDead ? "dead_link" : "failed",
        scrape_error: fetchError,
      }).eq("id", festival.id);
      failed++;
      console.log(`  ✗ [${festival.id}] ${festival.festival_name} — ${fetchError}`);
      return;
    }

    const $ = cheerio.load(html);
    const bodyText = $("body").text().replace(/\s+/g, " ");
    const { deadline, festivalStart, festivalEnd } = extractDates(bodyText);

    const patch = {
      last_scraped_at: new Date().toISOString(),
      scrape_status: deadline ? "ok" : "manual_review",
      scrape_error: null,
    };

    if (deadline) patch.submission_deadline = deadline;
    if (festivalStart) patch.festival_start_date = festivalStart;
    if (festivalEnd) patch.festival_end_date = festivalEnd;

    await db.from("festivals").update(patch).eq("id", festival.id);

    if (deadline) {
      updated++;
      console.log(`  ✓ [${festival.id}] ${festival.festival_name} → deadline: ${deadline}`);
    } else {
      noChange++;
      console.log(`  ~ [${festival.id}] ${festival.festival_name} — no deadline found, flagged for review`);
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
