/**
 * RSS / Atom Fetcher
 *
 * Fetches a feed URL and returns a normalized list of RssItem objects.
 * Handles both RSS 2.0 and Atom 1.0.
 *
 * Each RssItem has:
 *   title       — raw item/entry title
 *   link        — canonical URL for this item
 *   description — full text content (HTML stripped)
 *   pubDate     — ISO date string or null
 *   categories  — string[]
 */

import * as cheerio from "cheerio";

const USER_AGENT =
  "UberFestivalPipelineBot/1.0 (+https://uberfestival.com; rss-ingestion)";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES   = 5 * 1024 * 1024; // 5 MB — ignore pathologically large feeds

/**
 * @param {string} url
 * @returns {Promise<{ items: RssItem[], feedTitle: string, error: string|null }>}
 */
export async function fetchFeed(url) {
  let xml;
  try {
    xml = await fetchXml(url);
  } catch (err) {
    return { items: [], feedTitle: "", error: err.message };
  }

  try {
    const result = parseFeed(xml);
    return { ...result, error: null };
  } catch (err) {
    return { items: [], feedTitle: "", error: `parse_error: ${err.message}` };
  }
}

// ── Fetching ──────────────────────────────────────────────────────────────────

async function fetchXml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.8",
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (
      !contentType.includes("xml") &&
      !contentType.includes("rss") &&
      !contentType.includes("atom")
    ) {
      // Allow text/html in case the server is misconfigured but returns valid XML
      if (!contentType.includes("text/html")) {
        throw new Error(`Unexpected content-type: ${contentType}`);
      }
    }

    // Stream body with size cap to avoid OOM on huge responses
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) throw new Error("Feed body exceeds 5 MB limit");
      chunks.push(value);
    }

    const full = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    return full.toString("utf-8");
  } finally {
    clearTimeout(timer);
  }
}

// ── Parsing ───────────────────────────────────────────────────────────────────

/**
 * Parses RSS 2.0 or Atom 1.0 XML.
 * @param {string} xml
 * @returns {{ items: RssItem[], feedTitle: string }}
 */
function parseFeed(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });

  // Detect format
  const isAtom = $("feed").length > 0;

  return isAtom ? parseAtom($) : parseRss($);
}

function parseRss($) {
  const feedTitle = $("channel > title").first().text().trim();
  const items = [];

  $("channel > item").each((_, el) => {
    const $el = $(el);

    const title       = $el.find("title").first().text().trim();
    const link        = $el.find("link").first().text().trim()
                     || $el.find("link").first().attr("href")
                     || "";
    const description = stripHtml(
      $el.find("description").first().text() ||
      $el.find("content\\:encoded").first().text()
    );
    const pubDateRaw  = $el.find("pubDate").first().text()
                     || $el.find("dc\\:date").first().text();
    const categories  = $el.find("category").map((_, c) => $(c).text().trim()).get();

    if (!title && !link) return; // Skip empty items

    items.push({
      title,
      link:        sanitizeUrl(link),
      description: description.slice(0, 2000),
      pubDate:     parseDate(pubDateRaw),
      categories,
    });
  });

  return { feedTitle, items };
}

function parseAtom($) {
  const feedTitle = $("feed > title").first().text().trim();
  const items = [];

  $("feed > entry").each((_, el) => {
    const $el = $(el);

    const title       = $el.find("title").first().text().trim();
    const link        = $el.find("link[rel='alternate']").attr("href")
                     || $el.find("link").first().attr("href")
                     || $el.find("link").first().text().trim()
                     || "";
    const description = stripHtml(
      $el.find("content").first().text() ||
      $el.find("summary").first().text()
    );
    const pubDateRaw  = $el.find("updated").first().text()
                     || $el.find("published").first().text();
    const categories  = $el.find("category").map((_, c) => $(c).attr("term") ?? $(c).text()).get();

    if (!title && !link) return;

    items.push({
      title,
      link:        sanitizeUrl(link),
      description: description.slice(0, 2000),
      pubDate:     parseDate(pubDateRaw),
      categories,
    });
  });

  return { feedTitle, items };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sanitizeUrl(raw) {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    return url.toString();
  } catch {
    return null;
  }
}

function parseDate(raw) {
  if (!raw) return null;
  try {
    const dt = new Date(raw.trim());
    return isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}
