/**
 * discover-sources.mjs
 *
 * For each active scrape_source, fetches the page, extracts all links that
 * look like individual festival listings, fetches each listing page, and
 * attempts to extract structured data.
 *
 * Results land in festival_staging for admin review — nothing is written
 * directly to festivals.
 *
 * Links are filtered against festivals and staging already in the DB to
 * avoid creating duplicates.
 */

import * as cheerio from "cheerio";
import { db } from "../lib/supabase.mjs";
import { fetchPage } from "../lib/fetch-page.mjs";
import { extractFestivalInfo } from "../lib/extract-festival.mjs";

// A link on a source page is a candidate listing if its text or URL matches.
const FESTIVAL_LINK_KEYWORDS = [
  "festival", "music", "call", "submission", "apply", "open call",
  "showcase", "performance", "opportunity", "residency",
];

// Patterns that indicate navigation / boilerplate links — skip these.
const SKIP_PATTERNS = [
  /\/(about|contact|privacy|terms|faq|login|signup|register|search|tag|category|page\/\d)/i,
  /^(mailto|tel|javascript):/i,
  /#$/,
];

const BATCH_SIZE = 4;
const BATCH_DELAY_MS = 1500;

export async function discoverFromSources() {
  const { data: sources, error } = await db
    .from("scrape_sources")
    .select("id, name, url")
    .eq("is_active", true)
    .order("last_scraped_at", { ascending: true, nullsFirst: true });

  if (error) throw new Error(`Failed to load sources: ${error.message}`);
  if (!sources?.length) {
    console.log("discover: no active sources.");
    return;
  }

  // Pre-load known URLs to deduplicate without hitting the DB on every insert.
  const knownUrls = await loadKnownUrls();

  let totalFound = 0;

  for (const source of sources) {
    console.log(`discover: scanning ${source.name} — ${source.url}`);
    const found = await processSource(source, knownUrls);
    totalFound += found;

    await db.from("scrape_sources").update({
      last_scraped_at: new Date().toISOString(),
      festivals_found: found,
    }).eq("id", source.id);
  }

  console.log(`discover: done. total staged=${totalFound}`);
}

// ─── Internal ────────────────────────────────────────────────────────────────

async function processSource(source, knownUrls) {
  const { html, error } = await fetchPage(source.url);
  if (!html) {
    console.log(`  ✗ failed to fetch source: ${error}`);
    return 0;
  }

  const links = extractCandidateLinks(html, source.url);
  console.log(`  → ${links.length} candidate links found`);

  let staged = 0;

  for (let i = 0; i < links.length; i += BATCH_SIZE) {
    const batch = links.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((url) => processListing(url, knownUrls))
    );
    staged += results.filter(Boolean).length;
    if (i + BATCH_SIZE < links.length) await sleep(BATCH_DELAY_MS);
  }

  return staged;
}

async function processListing(url, knownUrls) {
  if (knownUrls.has(url)) return false; // already known

  const { html, error } = await fetchPage(url);
  if (!html) return false;

  const info = extractFestivalInfo(html, url);

  // Skip if we couldn't extract a name — too noisy to review.
  if (!info.festival_name) return false;

  // Skip if this looks like a navigation/listing page rather than a festival page.
  if (looksLikeListingPage(html)) return false;

  const { error: insertError } = await db.from("festival_staging").insert({
    ...info,
    status: "pending",
  });

  if (insertError) {
    console.log(`  ✗ failed to stage ${url}: ${insertError.message}`);
    return false;
  }

  knownUrls.add(url); // prevent duplicate within same run
  console.log(`  + staged: ${info.festival_name} (${url})`);
  return true;
}

function extractCandidateLinks(html, sourceUrl) {
  const $ = cheerio.load(html);
  const base = new URL(sourceUrl);
  const seen = new Set();
  const links = [];

  $("a[href]").each((_, el) => {
    const text = ($(el).text() + " " + ($(el).attr("aria-label") ?? "")).toLowerCase();
    const href = $(el).attr("href") ?? "";

    if (SKIP_PATTERNS.some((re) => re.test(href))) return;

    const hasFestivalKeyword = FESTIVAL_LINK_KEYWORDS.some(
      (kw) => text.includes(kw) || href.toLowerCase().includes(kw)
    );
    if (!hasFestivalKeyword) return;

    try {
      const abs = new URL(href, base).href;
      // Only follow links from the same domain or clearly external festival pages.
      if (!seen.has(abs)) {
        seen.add(abs);
        links.push(abs);
      }
    } catch {
      // ignore unparseable URLs
    }
  });

  // Cap at 30 links per source page to stay within GitHub Actions time limits.
  return links.slice(0, 30);
}

function looksLikeListingPage(html) {
  // Skip pages that look like paginated directories (many repeated card/item
  // elements) rather than individual festival pages.
  // We use a high threshold (60) so that normal nav menus don't trigger this.
  const $ = cheerio.load(html);
  const listLinks = $("ul a, ol a").length;
  return listLinks > 60;
}

async function loadKnownUrls() {
  const set = new Set();

  const [festivalsRes, stagingRes] = await Promise.all([
    db.from("festivals").select("application_url, website"),
    db.from("festival_staging").select("source_url, application_url"),
  ]);

  for (const f of festivalsRes.data ?? []) {
    if (f.application_url) set.add(f.application_url);
    if (f.website) set.add(f.website);
  }
  for (const s of stagingRes.data ?? []) {
    if (s.source_url) set.add(s.source_url);
    if (s.application_url) set.add(s.application_url);
  }

  return set;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
