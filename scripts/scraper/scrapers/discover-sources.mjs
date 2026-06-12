/**
 * discover-sources.mjs
 *
 * For each active scrape_source, crawls the listing page, extracts candidate
 * links, fetches each one, classifies it, and stages accepted opportunities.
 *
 * Quality gate (classify-page.mjs):
 *   confidence < 55  → reject (never written to festival_staging)
 *   missing festival_name or website → reject
 *   blocked domain or article URL path → instant reject
 *
 * Results land in festival_staging for admin review.
 */

import * as cheerio from "cheerio";
import { db } from "../lib/supabase.mjs";
import { fetchPage } from "../lib/fetch-page.mjs";
import { extractFestivalInfo } from "../lib/extract-festival.mjs";
import { classifyPage } from "../lib/classify-page.mjs";

const FESTIVAL_LINK_KEYWORDS = [
  "festival", "music", "call", "submission", "apply", "open call",
  "showcase", "performance", "opportunity", "residency",
  "grant", "award", "competition", "fund",
];

const SKIP_PATTERNS = [
  /\/(about|contact|privacy|terms|faq|login|signup|register|search|tag|category|page\/\d)/i,
  /^(mailto|tel|javascript):/i,
  /#$/,
  // Profile and account pages — musician bios, user dashboards, auth
  /\/(musician|performer|profile|user|account|dashboard|my-|sign-?in)s?\//i,
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

  const knownUrls = await loadKnownUrls();
  let totalStaged = 0;

  for (const source of sources) {
    console.log(`discover: scanning ${source.name} — ${source.url}`);
    const found = await processSource(source, knownUrls);
    totalStaged += found;

    await db.from("scrape_sources").update({
      last_scraped_at: new Date().toISOString(),
      festivals_found: found,
    }).eq("id", source.id);
  }

  console.log(`discover: done. total staged=${totalStaged}`);
}

// ─── Internal ────────────────────────────────────────────────────────────────

async function processSource(source, knownUrls) {
  const { html, error } = await fetchPage(source.url);
  if (!html) {
    console.log(`  ✗ failed to fetch source: ${error}`);
    return 0;
  }

  const links = extractCandidateLinks(html, source.url);
  console.log(`  → ${links.length} candidate links`);

  let staged = 0;

  for (let i = 0; i < links.length; i += BATCH_SIZE) {
    const batch = links.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(url => processListing(url, knownUrls)));
    staged += results.filter(Boolean).length;
    if (i + BATCH_SIZE < links.length) await sleep(BATCH_DELAY_MS);
  }

  return staged;
}

async function processListing(url, knownUrls) {
  if (knownUrls.has(url)) {
    console.log(`  ~ skip (known): ${url}`);
    return false;
  }

  const { html, error } = await fetchPage(url);
  if (!html) {
    console.log(`  ✗ fetch failed: ${url} — ${error}`);
    return false;
  }

  // Skip pages that are clearly navigation/directory listings.
  if (looksLikeListingPage(html)) {
    console.log(`  ~ skip (listing page): ${url}`);
    return false;
  }

  const info = extractFestivalInfo(html, url);

  // Classify: apply quality gate before any DB write.
  const { confidence, accept, reason } = classifyPage(url, info);

  if (!accept) {
    console.log(`  ✗ rejected (${confidence}): ${url} — ${reason}`);
    return false;
  }

  // Ensure application_url is set (falls back to website per requirement #4).
  if (!info.application_url && info.website) {
    info.application_url = info.website;
  }

  const { error: insertError } = await db.from("festival_staging").insert({
    festival_name:       info.festival_name,
    country:             info.country,
    city:                info.city,
    genre:               info.genre,
    application_url:     info.application_url,
    submission_deadline: info.submission_deadline,
    festival_start_date: info.festival_start_date,
    festival_end_date:   info.festival_end_date,
    website:             info.website,
    social_links:        info.social_links,
    source_url:          url,
    raw_text:            info.raw_text,
    status:              "pending",
  });

  if (insertError) {
    console.log(`  ✗ insert failed: ${url} — ${insertError.message}`);
    return false;
  }

  knownUrls.add(url);
  const geoStr = [info.city, info.country].filter(Boolean).join(", ") || "no geo";
  console.log(`  + staged (${confidence}): "${info.festival_name}" | ${geoStr}`);
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
    if (SKIP_PATTERNS.some(re => re.test(href))) return;
    const hasKeyword = FESTIVAL_LINK_KEYWORDS.some(
      kw => text.includes(kw) || href.toLowerCase().includes(kw)
    );
    if (!hasKeyword) return;
    try {
      const abs = new URL(href, base).href;
      if (!seen.has(abs)) { seen.add(abs); links.push(abs); }
    } catch { /* ignore */ }
  });

  return links.slice(0, 30);
}

function looksLikeListingPage(html) {
  const $ = cheerio.load(html);
  return $("ul a, ol a").length > 60;
}

async function loadKnownUrls() {
  const set = new Set();
  const [festivalsRes, stagingRes] = await Promise.all([
    db.from("festivals").select("application_url, website"),
    db.from("festival_staging").select("source_url, application_url"),
  ]);
  for (const f of festivalsRes.data ?? []) {
    if (f.application_url) set.add(f.application_url);
    if (f.website)         set.add(f.website);
  }
  for (const s of stagingRes.data ?? []) {
    if (s.source_url)      set.add(s.source_url);
    if (s.application_url) set.add(s.application_url);
  }
  return set;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
