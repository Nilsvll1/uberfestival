/**
 * Content enrichment: hero images and descriptions for the festivals table.
 *
 * Each festival's website is fetched once to extract:
 *   - og:image / twitter:image  → hero_image_url
 *   - og:description            → description (if quality gate passes)
 *
 * For festivals that still lack a description after the website pass, a
 * Wikipedia REST API summary is attempted, then a structured template.
 *
 * Usage:
 *   node --env-file=.env enrich-content.mjs              # full run
 *   node --env-file=.env enrich-content.mjs --dry-run    # preview, no writes
 *   node --env-file=.env enrich-content.mjs --phase=img  # images only
 *   node --env-file=.env enrich-content.mjs --phase=desc # descriptions only
 *   node --env-file=.env enrich-content.mjs --limit=20   # first N festivals
 *   node --env-file=.env enrich-content.mjs --report     # stats only
 */

import { db }         from "./lib/supabase.mjs";
import { fetchPage }  from "./lib/fetch-page.mjs";

const args      = process.argv.slice(2);
const DRY_RUN   = args.includes("--dry-run");
const REPORT    = args.includes("--report");
const phaseArg  = args.find(a => a.startsWith("--phase="))?.split("=")[1];
const limitArg  = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "0", 10);
const fromArg   = parseInt(args.find(a => a.startsWith("--from="))?.split("=")[1] ?? "0", 10);

const RUN_IMG   = !phaseArg || phaseArg === "img";
const RUN_DESC  = !phaseArg || phaseArg === "desc";

const PAGE_SIZE   = 200;
const BATCH_SIZE  = 2;   // concurrent fetches (polite to festival sites)
const FETCH_DELAY = 1100; // ms between batch waves

const USER_AGENT = "Mozilla/5.0 (compatible; UberFestivalBot/1.0; +https://uberfestival.com)";

// Patterns that flag a bad image URL — logos, icons, placeholders
const BAD_IMG_PATTERNS = [
  /\/logo[_\-./]/i, /\/favicon/i, /\/icon[_\-./]/i, /\/avatar/i,
  /\/placeholder/i, /\/default/i, /\.ico$/i, /\/apple-touch/i,
  /data:image\/svg/i, // inline SVG data URIs (usually logos)
];

// og:description quality gates — reject generic boilerplate
const GENERIC_DESC_PATTERNS = [
  /bringing together music lovers/i, /world[- ]class\s+(music|festival)/i,
  /unforgettable experience/i, /exciting music festival/i,
  /vibrant music festival/i, /celebrating music/i,
  /^\s*welcome to/i, /\bour festival\b/i,
  /\bcookie\b.*\bpolic/i, /\bprivacy polic/i, // accidentally scraped policy text
];

console.log(`\n${"═".repeat(72)}`);
console.log(`  UberFestival — Content Enrichment${DRY_RUN ? "  [DRY RUN]" : ""}`);
console.log(`  ${new Date().toISOString()}`);
if (phaseArg) console.log(`  Phase: ${phaseArg}`);
if (limitArg) console.log(`  Limit: ${limitArg} festivals`);
console.log(`${"═".repeat(72)}\n`);

if (REPORT) {
  await printReport();
  process.exit(0);
}

// ── Phase 1: Website fetch → og:image + og:description ───────────────────────

const stats = { websites: 0, images: 0, ogDescs: 0, wikis: 0, templates: 0, errors: 0 };

if (RUN_IMG || RUN_DESC) {
  console.log("── Phase 1: Website fetch (og:image + og:description) ──");

  // Select festivals that are missing hero_image_url (if running img phase)
  // or missing description (if running desc phase), or both.
  let query = db.from("festivals")
    .select("id, festival_name, city, country, category, website, festival_start_date")
    .not("website", "is", null);

  if (RUN_IMG && !RUN_DESC) {
    query = query.is("hero_image_url", null);
  } else if (RUN_DESC && !RUN_IMG) {
    query = query.is("description", null);
  } else {
    // Both — fetch any festival missing either field
    query = query.or("hero_image_url.is.null,description.is.null");
  }

  query = query.order("id").range(fromArg, fromArg + (limitArg || 9999) - 1);

  const { data: festivals, error } = await query;
  if (error) { console.error("DB fetch error:", error.message); process.exit(1); }
  if (!festivals?.length) { console.log("  Nothing to enrich.\n"); }

  console.log(`  ${festivals?.length ?? 0} festivals to process\n`);

  for (let i = 0; i < (festivals?.length ?? 0); i += BATCH_SIZE) {
    const batch = festivals.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch.map(processWebsite));
    if (i + BATCH_SIZE < festivals.length) await sleep(FETCH_DELAY);
  }

  console.log(`\n  Website pass complete:`);
  console.log(`    Fetched:       ${stats.websites}`);
  console.log(`    Images found:  ${stats.images}`);
  console.log(`    og:desc used:  ${stats.ogDescs}`);
  console.log(`    Errors:        ${stats.errors}\n`);
}

// ── Phase 2: Wikipedia fallback for missing descriptions ─────────────────────

if (RUN_DESC) {
  console.log("── Phase 2: Wikipedia description fallback ──");

  const { data: needDesc } = await db.from("festivals")
    .select("id, festival_name, city, country, category, festival_start_date")
    .is("description", null)
    .order("id")
    .range(fromArg, fromArg + (limitArg || 9999) - 1);

  if (needDesc?.length) {
    console.log(`  ${needDesc.length} festivals still need descriptions\n`);

    for (let i = 0; i < needDesc.length; i += BATCH_SIZE) {
      const batch = needDesc.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map(processWikipedia));
      if (i + BATCH_SIZE < needDesc.length) await sleep(FETCH_DELAY);
    }
  } else {
    console.log("  All festivals now have descriptions.\n");
  }
}

// ── Phase 3: Structured template for any remaining gaps ──────────────────────

if (RUN_DESC) {
  console.log("── Phase 3: Structured template for remaining gaps ──");

  const { data: stillMissing } = await db.from("festivals")
    .select("id, festival_name, city, country, category, festival_start_date")
    .is("description", null)
    .order("id")
    .range(fromArg, fromArg + (limitArg || 9999) - 1);

  if (stillMissing?.length) {
    console.log(`  ${stillMissing.length} festivals using template fallback\n`);

    for (const f of stillMissing) {
      const desc = buildTemplate(f);
      if (!DRY_RUN) {
        await db.from("festivals").update({ description: desc }).eq("id", f.id);
      }
      console.log(`  [T] [${f.id}] ${f.festival_name.slice(0, 40).padEnd(40)} → ${desc.slice(0, 80)}`);
      stats.templates++;
    }
  } else {
    console.log("  No gaps remaining.\n");
  }
}

// ── Final report ──────────────────────────────────────────────────────────────

console.log(`\n  Summary: images=${stats.images} ogDescs=${stats.ogDescs} wikis=${stats.wikis} templates=${stats.templates} errors=${stats.errors}\n`);
await printReport();

// ── Processing functions ──────────────────────────────────────────────────────

async function processWebsite(festival) {
  const url = normalizeUrl(festival.website);
  if (!url) return;

  const { html, error } = await fetchPage(url);
  stats.websites++;

  if (!html) {
    stats.errors++;
    if (error) console.log(`  [!] [${festival.id}] ${festival.festival_name.slice(0, 40)} — ${error}`);
    return;
  }

  const patch = {};

  // Image
  if (RUN_IMG && !festival.hero_image_url) {
    const imgUrl = extractOgImage(html, url);
    if (imgUrl) {
      patch.hero_image_url = imgUrl;
      stats.images++;
      if (DRY_RUN) console.log(`  [img] [${festival.id}] ${festival.festival_name.slice(0, 35)} → ${imgUrl.slice(0, 80)}`);
    }
  }

  // Description
  if (RUN_DESC && !festival.description) {
    const desc = extractOgDescription(html, festival);
    if (desc) {
      patch.description = desc;
      stats.ogDescs++;
      if (DRY_RUN) console.log(`  [og:] [${festival.id}] ${festival.festival_name.slice(0, 35)} → ${desc.slice(0, 80)}`);
    }
  }

  if (!Object.keys(patch).length) return;

  if (!DRY_RUN) {
    const { error: dbErr } = await db.from("festivals").update(patch).eq("id", festival.id);
    if (dbErr) { stats.errors++; return; }
  }

  const fields = Object.keys(patch).join("+");
  if (!DRY_RUN) console.log(`  ✓ [${festival.id}] ${festival.festival_name.slice(0, 40).padEnd(40)} [${fields}]`);
}

async function processWikipedia(festival) {
  const name = festival.festival_name;
  // Wikipedia REST API — returns JSON summary for an article title
  const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;

  let data;
  try {
    const res = await withTimeout(
      fetch(apiUrl, { headers: { "User-Agent": USER_AGENT } }),
      8000
    );
    if (!res.ok) return;
    data = await res.json();
  } catch {
    return;
  }

  const extract = data?.extract;
  if (!extract || extract.length < 60) return;

  // Reject disambiguation pages
  if (/may refer to:/i.test(extract.slice(0, 200))) return;

  // Require "festival" in the opening sentence — filters towns, plants, TV shows, etc.
  // that happen to share a name with a festival. Without this, "Glastonbury" returns
  // the Somerset town article, "Green Man" returns an architecture article, etc.
  if (!extract.slice(0, 200).toLowerCase().includes("festival")) return;

  // Truncate to a clean sentence boundary, max ~400 chars
  const desc = truncateToSentence(extract, 400);
  if (!desc || desc.length < 60) return;

  if (!DRY_RUN) {
    await db.from("festivals").update({ description: desc }).eq("id", festival.id);
  }
  stats.wikis++;
  console.log(`  [W] [${festival.id}] ${name.slice(0, 40).padEnd(40)} → ${desc.slice(0, 80)}`);
}

// ── Extraction helpers ────────────────────────────────────────────────────────

function extractOgImage(html, pageUrl) {
  // Try og:image first, then twitter:image
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];

  for (const pat of patterns) {
    const match = html.match(pat);
    if (!match) continue;

    let imgUrl = match[1].trim();
    // Resolve relative URLs
    if (imgUrl.startsWith("//")) imgUrl = "https:" + imgUrl;
    else if (imgUrl.startsWith("/")) {
      try { imgUrl = new URL(imgUrl, pageUrl).href; } catch { continue; }
    }

    if (!imgUrl.startsWith("http")) continue;

    // Reject known-bad patterns
    if (BAD_IMG_PATTERNS.some(p => p.test(imgUrl))) continue;

    // Must look like an image URL or be from a CDN that serves images
    const hasImgExt = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(imgUrl);
    const isCdn = /cloudinary|imgix|cloudfront|fastly|akamai|wp-content|uploads/i.test(imgUrl);
    if (!hasImgExt && !isCdn) continue;

    return imgUrl;
  }
  return null;
}

function extractOgDescription(html, festival) {
  // og:description
  const patterns = [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{60,}?)["']/i,
    /<meta[^>]+content=["']([^"']{60,}?)["'][^>]+property=["']og:description["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{60,}?)["']/i,
    /<meta[^>]+content=["']([^"']{60,}?)["'][^>]+name=["']description["']/i,
  ];

  for (const pat of patterns) {
    const match = html.match(pat);
    if (!match) continue;

    const raw = decodeHtmlEntities(match[1].trim());
    if (raw.length < 60) continue;

    // Quality gate
    if (GENERIC_DESC_PATTERNS.some(p => p.test(raw))) continue;

    // Must mention the city, country, or festival name to be specific
    const lower = raw.toLowerCase();
    const hasLocation = festival.city && lower.includes(festival.city.toLowerCase()) ||
                        festival.country && lower.includes(festival.country.toLowerCase());
    const hasFestivalWord = lower.includes("festival") || lower.includes("music");
    if (!hasLocation && !hasFestivalWord) continue;

    return truncateToSentence(raw, 400);
  }
  return null;
}

function buildTemplate(f) {
  const genre = (f.category || "music").toLowerCase();
  const location = [f.city, f.country].filter(Boolean).join(", ") || "an undisclosed location";
  let desc = `${f.festival_name} is a ${genre} festival held in ${location}.`;
  if (f.festival_start_date) {
    const month = new Date(f.festival_start_date).toLocaleString("en-US", { month: "long" });
    if (month !== "Invalid Date") desc += ` It typically takes place in ${month}.`;
  }
  return desc;
}

// ── Utility functions ─────────────────────────────────────────────────────────

function normalizeUrl(website) {
  if (!website) return null;
  if (website.startsWith("http://") || website.startsWith("https://")) return website;
  // Domain-only like "glastonbury.com" → add https://
  return `https://${website}`;
}

function truncateToSentence(text, maxLen) {
  if (text.length <= maxLen) return text.trim();
  const truncated = text.slice(0, maxLen);
  // Find last sentence boundary
  const lastPeriod = Math.max(truncated.lastIndexOf(". "), truncated.lastIndexOf("! "), truncated.lastIndexOf("? "));
  if (lastPeriod > maxLen * 0.5) return truncated.slice(0, lastPeriod + 1).trim();
  return truncated.slice(0, truncated.lastIndexOf(" ")).trim() + "…";
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
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
  const [total, withImg, withDesc, withBoth] = await Promise.all([
    db.from("festivals").select("*", { count: "exact", head: true }),
    db.from("festivals").select("*", { count: "exact", head: true }).not("hero_image_url", "is", null),
    db.from("festivals").select("*", { count: "exact", head: true }).not("description", "is", null),
    db.from("festivals").select("*", { count: "exact", head: true })
      .not("hero_image_url", "is", null).not("description", "is", null),
  ]);

  const n = total.count ?? 0;
  const pct = v => n ? `${Math.round(v / n * 100)}%` : "—";

  console.log(`${"═".repeat(72)}`);
  console.log("  CONTENT COVERAGE REPORT");
  console.log(`  ${new Date().toISOString()}`);
  console.log(`${"═".repeat(72)}`);
  console.log(`  Total festivals:       ${n}`);
  console.log(`  With hero_image_url:   ${withImg.count ?? 0}  (${pct(withImg.count ?? 0)})`);
  console.log(`  With description:      ${withDesc.count ?? 0}  (${pct(withDesc.count ?? 0)})`);
  console.log(`  With both:             ${withBoth.count ?? 0}  (${pct(withBoth.count ?? 0)})`);
  console.log();
}
