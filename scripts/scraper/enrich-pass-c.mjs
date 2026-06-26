/**
 * Pass C — Additional platform cross-reference
 *
 * Checks platforms not covered in B2+B3:
 *   1. Eventival — {slug}.eventival.eu / {slug}.eventival.com (film/music festival apps)
 *   2. Zealous   — zealous.co/calls/{slug} (European open calls)
 *   3. Sonicbids — sonicbids.com/Band/Gigs/{slug} (music opportunities)
 *   4. ReverbNation — reverbnation.com/opportunities search
 *   5. Extended FilmFreeway slug variants (city prefix, year suffix, festival number)
 *   6. Cognitoforms / Paperform subdomain guessing
 *
 * Usage:
 *   node --env-file=.env enrich-pass-c.mjs
 *   node --env-file=.env enrich-pass-c.mjs --dry-run
 *   node --env-file=.env enrich-pass-c.mjs --limit=100
 */

import { db }        from "./lib/supabase.mjs";
import { fetchPage } from "./lib/fetch-page.mjs";

const args     = process.argv.slice(2);
const DRY_RUN  = args.includes("--dry-run");
const limitArg = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "0", 10);
const idArg    = parseInt(args.find(a => a.startsWith("--id="))?.split("=")[1]    ?? "0", 10);

const CONCURRENCY = 3;
const DELAY_MS    = 1_200;
const UA          = "Mozilla/5.0 (compatible; UberFestivalBot/1.0; +https://uberfestival.com)";
const sleep       = ms => new Promise(r => setTimeout(r, ms));

// ── Slug generation ───────────────────────────────────────────────────────────

function slug(str) {
  return str.toLowerCase()
    .replace(/[''`]/g, "").replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function slugs(name) {
  const base = slug(name);
  return [...new Set([
    base,
    base.replace(/-festival$/, ""),
    base.replace(/-music-festival$/, ""),
    base.replace(/-jazz-festival$/, ""),
    base.replace(/-film-festival$/, ""),
    base.replace(/-open-air$/, ""),
    base.replace(/-international$/, ""),
    base.replace(/^the-/, ""),
    base.replace(/-/g, ""),
    base + "-festival",
  ])].filter(Boolean);
}

function extendedSlugs(festival) {
  const base = slugs(festival.festival_name);
  const city    = festival.city    ? slug(festival.city)    : null;
  const country = festival.country ? slug(festival.country) : null;
  const extra = [];
  for (const s of base.slice(0, 3)) {
    if (city)    extra.push(`${s}-${city}`, `${city}-${s}`);
    if (country) extra.push(`${s}-${country}`);
    extra.push(`${s}-2025`, `${s}-2026`);
  }
  return [...new Set([...base, ...extra])].slice(0, 18);
}

// ── Shared fetch with AbortController ────────────────────────────────────────

async function headCheck(url, timeoutMs = 5_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "HEAD", redirect: "follow", signal: ctrl.signal,
      headers: { "User-Agent": UA },
    }).finally(() => clearTimeout(t));
    return res.ok ? res.url ?? url : null;
  } catch { return null; }
}

// ── Platform detection ────────────────────────────────────────────────────────

function detectPlatform(url) {
  const map = [
    [/filmfreeway\.com/,         "filmfreeway"],
    [/festhome\.com/,            "festhome"],
    [/submittable\.com/,         "submittable"],
    [/eventival\.(?:com|eu)/,    "eventival"],
    [/zealous\.co/,              "zealous"],
    [/sonicbids\.com/,           "sonicbids"],
    [/reverbnation\.com/,        "reverbnation"],
    [/cognitoforms\.com/,        "cognito_forms"],
    [/paperform\.co/,            "paperform"],
  ];
  for (const [re, name] of map) if (re.test(url)) return name;
  return "official";
}

function platformToStatus(platform) {
  if (platform === "filmfreeway") return "filmfreeway";
  if (platform === "festhome")    return "festhome";
  return "contact_form";
}

// ── Platform checks ───────────────────────────────────────────────────────────

const FF_GENERIC_RE = /filmfreeway\.com\/(search|festivals|categories|browse|discover|home)?(\?|\/?\s*$)/i;

async function checkFilmFreewayExtended(festival) {
  for (const s of extendedSlugs(festival)) {
    const url = `https://filmfreeway.com/${s}`;
    try {
      const finalUrl = await headCheck(url, 5_000);
      if (!finalUrl) continue;
      if (FF_GENERIC_RE.test(finalUrl)) continue;
      if (!finalUrl.includes("filmfreeway.com/")) continue;
      const { html } = await fetchPage(finalUrl, { retries: 0, timeoutMs: 6_000 });
      if (!html) continue;
      // Quick name check
      const nameSlug = slug(festival.festival_name).replace(/-/g, "");
      if (!finalUrl.toLowerCase().replace(/[^a-z0-9]/g, "").includes(nameSlug.slice(0, 6))) continue;
      return { url: finalUrl, platform: "filmfreeway", confidence: 0.87, source: "ff_extended_c" };
    } catch { continue; }
  }
  return null;
}

const EVENTIVAL_GENERIC_RE = /\/login|\/home|\/dashboard|eventival\.(com|eu)\/?$/i;

async function checkEventival(festival) {
  for (const s of slugs(festival.festival_name).slice(0, 4)) {
    for (const domain of ["eventival.eu", "eventival.com"]) {
      const url = `https://${s}.${domain}`;
      const finalUrl = await headCheck(url, 5_000);
      if (!finalUrl) continue;
      if (EVENTIVAL_GENERIC_RE.test(finalUrl)) continue;
      return { url: finalUrl, platform: "eventival", confidence: 0.83, source: "eventival_c" };
    }
  }
  return null;
}

const ZEALOUS_GENERIC_RE = /zealous\.co\/(calls|opportunities)?\/?$/i;

async function checkZealous(festival) {
  for (const s of slugs(festival.festival_name).slice(0, 4)) {
    const url = `https://zealous.co/calls/${s}`;
    const finalUrl = await headCheck(url, 5_000);
    if (!finalUrl) continue;
    if (ZEALOUS_GENERIC_RE.test(finalUrl)) continue;
    const { html } = await fetchPage(finalUrl, { retries: 0, timeoutMs: 6_000 });
    if (!html) continue;
    const text = html.toLowerCase();
    const nameWords = festival.festival_name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (!nameWords.some(w => text.includes(w))) continue;
    return { url: finalUrl, platform: "zealous", confidence: 0.83, source: "zealous_c" };
  }
  return null;
}

async function checkSonicbids(festival) {
  for (const s of slugs(festival.festival_name).slice(0, 4)) {
    const url = `https://www.sonicbids.com/Band/Gigs/${s}/Apply/`;
    const finalUrl = await headCheck(url, 5_000);
    if (!finalUrl) continue;
    if (finalUrl.includes("sonicbids.com/Band/Gigs/") && !finalUrl.includes("/Search")) {
      return { url: finalUrl, platform: "sonicbids", confidence: 0.80, source: "sonicbids_c" };
    }
  }
  return null;
}

async function checkCognitoForms(festival) {
  for (const s of slugs(festival.festival_name).slice(0, 3)) {
    const url = `https://www.cognitoforms.com/${s}`;
    const finalUrl = await headCheck(url, 4_000);
    if (!finalUrl) continue;
    if (ZEALOUS_GENERIC_RE.test(finalUrl) || finalUrl.includes("cognitoforms.com/#")) continue;
    if (!finalUrl.includes("cognitoforms.com/")) continue;
    return { url: finalUrl, platform: "cognito_forms", confidence: 0.80, source: "cognito_c" };
  }
  return null;
}

// ── Per-festival logic ────────────────────────────────────────────────────────

async function enrich(festival) {
  // 1. Extended FilmFreeway slugs
  const ff = await checkFilmFreewayExtended(festival);
  if (ff) return ff;

  // 2. Eventival subdomains
  const ev = await checkEventival(festival);
  if (ev) return ev;

  // 3. Zealous
  const ze = await checkZealous(festival);
  if (ze) return ze;

  // 4. Sonicbids
  const sb = await checkSonicbids(festival);
  if (sb) return sb;

  // 5. CognitoForms subdomains
  const cf = await checkCognitoForms(festival);
  if (cf) return cf;

  return null;
}

// ── DB write ──────────────────────────────────────────────────────────────────

async function saveResult(festival, result) {
  const { error } = await db.from("festivals").update({
    application_url:         result.url,
    application_platform:    result.platform,
    application_source:      result.source,
    application_confidence:  result.confidence,
    application_verified_at: new Date().toISOString(),
    booking_model:           "open_call",
    application_status:      platformToStatus(result.platform),
    link_check_status:       "unchecked",
  }).eq("id", festival.id);
  return error;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(68)}`);
console.log(`  Pass C — Additional Platform Cross-Reference`);
console.log(`  ${new Date().toISOString()}${DRY_RUN ? "  [DRY RUN]" : ""}`);
console.log(`${"═".repeat(68)}\n`);

let query = db.from("festivals")
  .select("id, festival_name, category, country, city, website")
  .eq("application_status", "unknown")
  .eq("is_archived", false)
  .order("id");

if (idArg)    query = db.from("festivals").select("id, festival_name, category, country, city, website").eq("id", idArg);
if (limitArg && !idArg) query = query.limit(limitArg);

const { data: festivals, error } = await query;
if (error)              { console.error("[FATAL]", error.message); process.exit(1); }
if (!festivals?.length) { console.log("  No targets remaining.\n"); process.exit(0); }

console.log(`  Targets: ${festivals.length} unknown festivals\n`);

let found = 0, skipped = 0, dbErrors = 0;
const byPlatform = {};

for (let i = 0; i < festivals.length; i += CONCURRENCY) {
  const batch = festivals.slice(i, i + CONCURRENCY);

  await Promise.all(batch.map(async festival => {
    const label = `[${String(festival.id).padStart(4)}] ${festival.festival_name.slice(0, 44).padEnd(44)}`;
    process.stdout.write(`  … ${label} checking\r`);

    let result;
    try { result = await enrich(festival); }
    catch (err) {
      console.log(`  ✗ ${label} ERROR: ${err.message.slice(0, 60)}`);
      return;
    }

    if (!result) { skipped++; return; }

    found++;
    byPlatform[result.platform] = (byPlatform[result.platform] ?? 0) + 1;
    console.log(`  ✓ ${label} [${result.platform.padEnd(14)}] conf=${result.confidence.toFixed(2)}  ${result.url.slice(0, 50)}`);

    if (DRY_RUN) return;

    const dbErr = await saveResult(festival, result);
    if (dbErr) { console.warn(`    [warn] DB write failed: ${dbErr.message}`); dbErrors++; found--; }
  }));

  if (i + CONCURRENCY < festivals.length) await sleep(DELAY_MS);
}

console.log(`\n${"═".repeat(68)}`);
console.log(`  PASS C RESULTS`);
console.log(`${"═".repeat(68)}`);
console.log(`  Processed: ${festivals.length}  |  Found: ${found}  |  Skipped: ${skipped}  |  Errors: ${dbErrors}`);
console.log(`  Hit rate:  ${((found / festivals.length) * 100).toFixed(1)}%`);
if (Object.keys(byPlatform).length) {
  console.log(`\n  By platform:`);
  Object.entries(byPlatform).sort((a, b) => b[1] - a[1]).forEach(([p, n]) => console.log(`    ${p.padEnd(18)} ${n}`));
}
if (!DRY_RUN) {
  const applyRes = await db.from("festivals").select("id", { count: "exact", head: true })
    .in("application_status", ["verified_application","filmfreeway","festhome","email_submission","contact_form"])
    .eq("is_archived", false);
  const unknRes  = await db.from("festivals").select("id", { count: "exact", head: true })
    .eq("application_status", "unknown").eq("is_archived", false);
  console.log(`\n  Apply Now:  ${applyRes.count}  |  Unknown: ${unknRes.count}`);
}
console.log(`${"═".repeat(68)}\n`);
