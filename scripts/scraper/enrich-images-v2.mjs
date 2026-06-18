/**
 * Image enrichment V2 — reaches for 80%+ festival-specific imagery.
 *
 * Phase A  Wikipedia pageimages API (batch, fast)
 *           Tries exact name then "{name} Festival" for each fallback festival.
 *           Filters flags, maps, logos, SVGs.
 *
 * Phase B  Body <img> extraction
 *           Re-fetches sites that are still missing an image, looks for the
 *           largest non-logo image in the page body.
 *
 * Usage:
 *   node --env-file=.env enrich-images-v2.mjs              # both phases
 *   node --env-file=.env enrich-images-v2.mjs --phase=wiki # Wikipedia only
 *   node --env-file=.env enrich-images-v2.mjs --phase=body # body extraction only
 *   node --env-file=.env enrich-images-v2.mjs --dry-run    # preview
 *   node --env-file=.env enrich-images-v2.mjs --limit=50   # first N
 *   node --env-file=.env enrich-images-v2.mjs --report     # coverage only
 */

import { db }        from "./lib/supabase.mjs";
import { fetchPage } from "./lib/fetch-page.mjs";

const args     = process.argv.slice(2);
const DRY_RUN  = args.includes("--dry-run");
const REPORT   = args.includes("--report");
const phaseArg = args.find(a => a.startsWith("--phase="))?.split("=")[1];
const limitArg = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "0", 10);

const RUN_WIKI = !phaseArg || phaseArg === "wiki";
const RUN_BODY = !phaseArg || phaseArg === "body";

const WIKI_BATCH   = 20;   // titles per Wikipedia API request
const BODY_BATCH   = 2;    // concurrent site fetches
const FETCH_DELAY  = 1100; // ms between body-fetch waves
const USER_AGENT   = "Mozilla/5.0 (compatible; UberFestivalBot/1.0; +https://uberfestival.com)";

// Patterns that indicate a bad Wikipedia image (flag, map, logo, SVG)
const BAD_WIKI_IMG = [
  /Flag_of_/i, /_flag\b/i, /_location_/i, /_locator_map/i, /location_map/i,
  /_map\b/i, /relief_map/i, /coat_of_arms/i, /_logo/i, /Logo_/i, /\.svg$/i,
  /commons\/thumb\/[0-9a-f]\/[0-9a-f]{2}\/Flag/i,
];

// Patterns that indicate a bad body image (logo, nav icon, placeholder)
const BAD_BODY_IMG = [
  /logo/i, /favicon/i, /\/icon[_.\-/]/i, /placeholder/i, /\.ico$/i,
  /apple-touch/i, /sprite/i, /\/avatar/i, /\.svg($|\?)/i,
  /data:image/i, /1x1/i, /pixel/i,
];

console.log(`\n${"═".repeat(72)}`);
console.log(`  UberFestival — Image Enrichment V2${DRY_RUN ? "  [DRY RUN]" : ""}`);
console.log(`  ${new Date().toISOString()}`);
console.log(`${"═".repeat(72)}\n`);

if (REPORT) { await printReport(); process.exit(0); }

const stats = { wiki: 0, body: 0, errors: 0 };

// ── Fetch fallback festivals ──────────────────────────────────────────────────

async function getFallbacks() {
  let all = [];
  let offset = 0;
  while (true) {
    const { data } = await db.from("festivals")
      .select("id, festival_name, category, website")
      .is("hero_image_url", null)
      .order("id")
      .range(offset, offset + 999);
    if (!data?.length) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return limitArg ? all.slice(0, limitArg) : all;
}

// ── Phase A: Wikipedia pageimages ─────────────────────────────────────────────

if (RUN_WIKI) {
  console.log("── Phase A: Wikipedia pageimages ──");
  const fallbacks = await getFallbacks();
  console.log(`  ${fallbacks.length} festivals without hero images\n`);

  // Process in batches of WIKI_BATCH (one API call per batch)
  for (let i = 0; i < fallbacks.length; i += WIKI_BATCH) {
    const batch = fallbacks.slice(i, i + WIKI_BATCH);
    const results = await fetchWikiImages(batch);

    for (const { festival, imgUrl } of results) {
      if (!imgUrl) continue;
      if (DRY_RUN) {
        console.log(`  [W] [${festival.id}] ${festival.festival_name.slice(0, 38).padEnd(38)} → ${imgUrl.slice(0, 80)}`);
      } else {
        const { error } = await db.from("festivals")
          .update({ hero_image_url: imgUrl })
          .eq("id", festival.id);
        if (error) { stats.errors++; continue; }
        console.log(`  ✓ [${festival.id}] ${festival.festival_name.slice(0, 38).padEnd(38)} [wiki]`);
      }
      stats.wiki++;
    }

    // Polite delay between Wikipedia batches
    await sleep(500);
  }

  console.log(`\n  Phase A complete: ${stats.wiki} images from Wikipedia\n`);
}

// ── Phase B: Body <img> extraction ───────────────────────────────────────────

if (RUN_BODY) {
  console.log("── Phase B: Body image extraction ──");
  const fallbacks = await getFallbacks();
  console.log(`  ${fallbacks.length} still without images after Phase A\n`);

  for (let i = 0; i < fallbacks.length; i += BODY_BATCH) {
    const batch = fallbacks.slice(i, i + BODY_BATCH);
    await Promise.allSettled(batch.map(processBodyImage));
    if (i + BODY_BATCH < fallbacks.length) await sleep(FETCH_DELAY);
  }

  console.log(`\n  Phase B complete: ${stats.body} images from body extraction\n`);
}

await printReport();
console.log(`  Total new images: wiki=${stats.wiki} body=${stats.body} errors=${stats.errors}\n`);

// ── Wikipedia pageimages batch fetch ─────────────────────────────────────────

async function fetchWikiImages(festivals) {
  // Build candidate title sets: try exact name, then "Name Festival"
  // We run two queries per batch to maximise hit rate.
  const results = [];
  const indexed = Object.fromEntries(festivals.map(f => [f.festival_name, f]));

  for (const useSuffix of [false, true]) {
    const remaining = festivals.filter(f => !results.find(r => r.festival === f)?.imgUrl);
    if (!remaining.length) break;

    const titles = remaining.map(f => useSuffix ? `${f.festival_name} Festival` : f.festival_name);
    const titleStr = titles.map(t => encodeURIComponent(t)).join("|");
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages|pageprops&piprop=original&ppprop=wikibase-shortdesc&titles=${titleStr}&format=json&redirects=1`;

    let data;
    try {
      const res = await withTimeout(
        fetch(url, { headers: { "User-Agent": USER_AGENT } }),
        10000
      );
      if (!res.ok) continue;
      data = await res.json();
    } catch { continue; }

    const pages = data?.query?.pages ?? {};

    // Build reverse map: resolved title → festival
    const redirects = data?.query?.redirects ?? [];
    const normalised = data?.query?.normalized ?? [];
    const titleToFestival = {};
    for (let idx = 0; idx < remaining.length; idx++) {
      titleToFestival[titles[idx].toLowerCase()] = remaining[idx];
    }
    // Apply normalisation and redirects
    const resolved = {};
    for (const n of normalised) resolved[n.to.toLowerCase()] = n.from.toLowerCase();
    for (const r of redirects) resolved[r.to.toLowerCase()] = (resolved[r.from.toLowerCase()] || r.from.toLowerCase());

    for (const page of Object.values(pages)) {
      if (page.missing !== undefined) continue;
      const imgUrl = validateWikiImage(page.original?.source, page.original?.width);
      if (!imgUrl) continue;

      const pageTitle = page.title.toLowerCase();
      // Find which festival this page corresponds to
      const fromTitle = resolved[pageTitle] || pageTitle;
      const festival = titleToFestival[fromTitle] || titleToFestival[pageTitle] ||
        remaining.find(f => pageTitle.includes(f.festival_name.toLowerCase()) ||
                            f.festival_name.toLowerCase().includes(pageTitle.split(" festival")[0]));
      if (!festival) continue;
      // Reject if the Wikipedia article is clearly for a different entity.
      // Two checks, either is sufficient to reject:
      // 1. Title mismatch: "Garden strawberry" ≠ "Strawberry"
      if (!pageTitleMatchesFestival(page.title, festival.festival_name)) continue;
      // 2. Wikidata short description exists and has no festival/music/arts terms.
      //    "plant species in the family Rosaceae" → reject.
      //    "annual music festival in Somerset" → accept.
      //    absent → accept (benefit of the doubt).
      const shortDesc = (page.pageprops?.["wikibase-shortdesc"] ?? "").toLowerCase();
      if (shortDesc && !/festival|music|concert|arts?\b|opera|jazz|folk|rock|electronic|culture/i.test(shortDesc)) continue;

      // Only store if not already found in a previous pass
      const existing = results.find(r => r.festival.id === festival.id);
      if (!existing) results.push({ festival, imgUrl });
      else if (!existing.imgUrl && imgUrl) existing.imgUrl = imgUrl;
    }
  }

  return results;
}

function validateWikiImage(src, width) {
  if (!src) return null;
  if (BAD_WIKI_IMG.some(p => p.test(src))) return null;
  if (width !== undefined && width < 200) return null;
  if (!src.startsWith("http")) return null;
  return src;
}

// Require the Wikipedia page title to be a plausible match for the festival.
// Strips punctuation and checks that one string starts with the other
// (case-insensitive, no whitespace). Rejects "Garden strawberry" for "Strawberry",
// "Somerset House" for "Summerset", etc.
function pageTitleMatchesFestival(pageTitle, festivalName) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const pt = norm(pageTitle);
  const fn = norm(festivalName);
  return pt.startsWith(fn) || fn.startsWith(pt);
}

// ── Body image extraction ─────────────────────────────────────────────────────

async function processBodyImage(festival) {
  const url = normalizeUrl(festival.website);
  if (!url) return;

  const { html } = await fetchPage(url);
  if (!html) { stats.errors++; return; }

  const imgUrl = extractBodyImage(html, url);
  if (!imgUrl) return;

  if (DRY_RUN) {
    console.log(`  [B] [${festival.id}] ${festival.festival_name.slice(0, 38).padEnd(38)} → ${imgUrl.slice(0, 80)}`);
  } else {
    const { error } = await db.from("festivals")
      .update({ hero_image_url: imgUrl })
      .eq("id", festival.id);
    if (error) { stats.errors++; return; }
    console.log(`  ✓ [${festival.id}] ${festival.festival_name.slice(0, 38).padEnd(38)} [body]`);
  }
  stats.body++;
}

function extractBodyImage(html, pageUrl) {
  // Strategy: collect all candidate images, score them, return best.
  const candidates = [];

  // 1. <picture><source srcset> — responsive images, almost always content
  for (const m of html.matchAll(/<source[^>]+srcset=["']([^"']+)["']/gi)) {
    const src = extractLargestSrcset(m[1]);
    if (src) candidates.push({ src, score: 3 });
  }

  // 2. <img src> with various attribute patterns
  for (const m of html.matchAll(/<img\b([^>]+)>/gi)) {
    const attrs = m[1];
    const src = extractAttr(attrs, "src") || extractAttr(attrs, "data-src") || extractAttr(attrs, "data-lazy-src");
    if (!src) continue;

    let score = 1;
    // Width attribute: prefer large images
    const w = parseInt(extractAttr(attrs, "width") || "0", 10);
    if (w > 800) score += 3;
    else if (w > 400) score += 2;
    else if (w > 0 && w < 100) score -= 3; // tiny image
    // Srcset present → content image
    if (/srcset=/i.test(attrs)) score += 2;
    // loading="eager" → above the fold
    if (/loading=["']eager["']/i.test(attrs)) score += 1;
    // class hints
    const cls = (extractAttr(attrs, "class") || "").toLowerCase();
    if (/\b(hero|banner|splash|featured|cover|header|poster|keyvisual|main)\b/.test(cls)) score += 3;
    if (/\b(logo|icon|avatar|thumb|sprite|nav)\b/.test(cls)) score -= 4;
    // alt text hints
    const alt = (extractAttr(attrs, "alt") || "").toLowerCase();
    if (/festival|music|event|concert/.test(alt)) score += 1;

    candidates.push({ src, score });
  }

  // Score and filter
  const resolved = candidates
    .map(c => ({ ...c, url: resolveUrl(c.src, pageUrl) }))
    .filter(c => c.url && c.url.startsWith("http"))
    .filter(c => !BAD_BODY_IMG.some(p => p.test(c.url)))
    .filter(c => {
      // Must look like an image
      const hasExt = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(c.url);
      const isCdn  = /cloudinary|imgix|cloudfront|fastly|akamai|wp-content\/uploads|squarespace|webflow|wixstatic|squimg/i.test(c.url);
      return hasExt || isCdn;
    })
    .sort((a, b) => b.score - a.score);

  return resolved[0]?.url ?? null;
}

function extractAttr(attrs, name) {
  const m = attrs.match(new RegExp(`${name}=["']([^"']+)["']`, "i"));
  return m?.[1]?.trim() || null;
}

function extractLargestSrcset(srcset) {
  // Parse "url 300w, url 600w, url 1200w" and return the largest
  const entries = srcset.split(",").map(s => {
    const parts = s.trim().split(/\s+/);
    const url   = parts[0];
    const w     = parseInt(parts[1] ?? "0", 10);
    return { url, w };
  }).filter(e => e.url);
  if (!entries.length) return null;
  return entries.sort((a, b) => b.w - a.w)[0].url;
}

function resolveUrl(src, base) {
  if (!src) return null;
  try {
    if (src.startsWith("//")) return "https:" + src;
    if (src.startsWith("/"))  return new URL(src, base).href;
    if (src.startsWith("http")) return src;
    return new URL(src, base).href;
  } catch { return null; }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function normalizeUrl(website) {
  if (!website) return null;
  if (website.startsWith("http://") || website.startsWith("https://")) return website;
  return `https://${website}`;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Report ────────────────────────────────────────────────────────────────────

async function printReport() {
  const [total, withImg] = await Promise.all([
    db.from("festivals").select("*", { count: "exact", head: true }),
    db.from("festivals").select("*", { count: "exact", head: true }).not("hero_image_url", "is", null),
  ]);
  const n   = total.count ?? 0;
  const img = withImg.count ?? 0;
  console.log(`${"═".repeat(72)}`);
  console.log("  IMAGE COVERAGE REPORT");
  console.log(`  ${new Date().toISOString()}`);
  console.log(`${"═".repeat(72)}`);
  console.log(`  Total festivals:       ${n}`);
  console.log(`  With hero_image_url:   ${img}  (${n ? Math.round(img/n*100) : 0}%)`);
  console.log(`  Still on fallback:     ${n - img}  (${n ? Math.round((n-img)/n*100) : 0}%)`);
  console.log();
}
