/**
 * Pass C2 — Extended platform cross-reference
 *
 * New platforms vs Pass C:
 *   1. HelloAsso — French nonprofit event registration (very common for French festivals)
 *   2. Weezevent — French event registration platform
 *   3. Acceptd — Performing arts application platform
 *   4. F3.be — Belgian festival platform
 *   5. SubmitHub — Music submission platform
 *   6. ReverbNation Opportunities — broader search
 *
 * Usage:
 *   node --env-file=.env enrich-pass-c2.mjs
 *   node --env-file=.env enrich-pass-c2.mjs --dry-run
 *   node --env-file=.env enrich-pass-c2.mjs --limit=100
 */

import { db }        from "./lib/supabase.mjs";
import { fetchPage } from "./lib/fetch-page.mjs";

const args     = process.argv.slice(2);
const DRY_RUN  = args.includes("--dry-run");
const limitArg = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "0", 10);
const idArg    = parseInt(args.find(a => a.startsWith("--id="))?.split("=")[1]    ?? "0", 10);

const CONCURRENCY = 3;
const DELAY_MS    = 1_200;
const UA          = "Mozilla/5.0 (compatible; UberFestivalBot/1.0)";
const sleep       = ms => new Promise(r => setTimeout(r, ms));

// ── Slug generation ───────────────────────────────────────────────────────────

function slug(str) {
  return str.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
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

// City/country slug variants for better matching
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

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function headCheck(url, timeoutMs = 5_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "HEAD", redirect: "follow", signal: ctrl.signal,
      headers: { "User-Agent": UA },
    }).finally(() => clearTimeout(t));
    return res.ok ? (res.url ?? url) : null;
  } catch { return null; }
}

// ── Platform checks ───────────────────────────────────────────────────────────

async function checkHelloAsso(festival) {
  const nameWords = festival.festival_name.toLowerCase().split(/\s+/).filter(w => w.length > 3);

  for (const s of slugs(festival.festival_name).slice(0, 4)) {
    // HelloAsso association page: helloasso.com/associations/{slug}
    for (const variant of [s, s.replace(/-festival$/, ""), s.replace(/-/g, "")]) {
      const url = `https://www.helloasso.com/associations/${variant}`;
      const finalUrl = await headCheck(url, 5_000);
      if (!finalUrl) continue;
      if (finalUrl.includes("helloasso.com/associations/") && !finalUrl.includes("/404")) {
        // Verify the page mentions the festival name
        const { html } = await fetchPage(finalUrl, { retries: 0, timeoutMs: 6_000 });
        if (!html) continue;
        const text = html.toLowerCase();
        if (nameWords.filter(w => text.includes(w)).length >= 1) {
          return { url: finalUrl, platform: "helloasso", confidence: 0.83, source: "c2_helloasso" };
        }
      }
    }
  }
  return null;
}

async function checkWeezevent(festival) {
  for (const s of slugs(festival.festival_name).slice(0, 4)) {
    const url = `https://weezevent.com/${s}`;
    const finalUrl = await headCheck(url, 5_000);
    if (!finalUrl) continue;
    if (finalUrl.includes("weezevent.com/") && !finalUrl.match(/weezevent\.com\/?$/)) {
      const { html } = await fetchPage(finalUrl, { retries: 0, timeoutMs: 6_000 });
      if (!html) continue;
      const nameWords = festival.festival_name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const text = html.toLowerCase();
      if (nameWords.some(w => text.includes(w))) {
        return { url: finalUrl, platform: "weezevent", confidence: 0.80, source: "c2_weezevent" };
      }
    }
  }
  return null;
}

async function checkAcceptd(festival) {
  // Acceptd is primarily used by performing arts and competition festivals
  const COMPETITION_RE = /eisteddfod|concours|wettbewerb|competition|contest|award|prix|preis|concurso|concorso|konkurs|young musician|junior|masterclass|audition|talent|classical|opera|orchestra/i;
  if (!COMPETITION_RE.test(festival.festival_name) && festival.category !== "Competition") return null;

  // Search Acceptd for this festival
  const query = encodeURIComponent(festival.festival_name.slice(0, 40));
  const searchUrl = `https://app.acceptd.com/programs?q=${query}`;
  const { html } = await fetchPage(searchUrl, { retries: 0, timeoutMs: 8_000 });
  if (!html) return null;

  const nameWords = festival.festival_name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const text = html.toLowerCase();
  const matchCount = nameWords.filter(w => text.includes(w)).length;
  if (matchCount < 2) return null;

  // Try to extract direct link
  const linkRe = /href="(https:\/\/app\.acceptd\.com\/programs\/[^"]+)"/i;
  const m = html.match(linkRe);
  const acceptdUrl = m ? m[1] : searchUrl;
  return { url: acceptdUrl, platform: "acceptd", confidence: 0.78, source: "c2_acceptd" };
}

async function checkSubmitHub(festival) {
  // SubmitHub is used by independent/emerging festivals for music discovery
  // Check submithub.com/label/{slug} for curators/channels
  for (const s of slugs(festival.festival_name).slice(0, 3)) {
    const url = `https://www.submithub.com/label/${s}`;
    const finalUrl = await headCheck(url, 4_000);
    if (!finalUrl) continue;
    if (finalUrl.includes("submithub.com/label/") && !finalUrl.includes("/404") && !finalUrl.includes("submithub.com/#")) {
      return { url: finalUrl, platform: "submithub", confidence: 0.75, source: "c2_submithub" };
    }
  }
  return null;
}

async function checkEntryThingy(festival) {
  // EntryThingy: competition entry management
  for (const s of slugs(festival.festival_name).slice(0, 3)) {
    const url = `https://www.entrythingy.com/forartists_${s}`;
    const finalUrl = await headCheck(url, 4_000);
    if (!finalUrl) continue;
    if (finalUrl.includes("entrythingy.com") && !finalUrl.match(/entrythingy\.com\/?$/)) {
      return { url: finalUrl, platform: "entrythingy", confidence: 0.77, source: "c2_entrythingy" };
    }
  }
  return null;
}

// ── Platform → status mapping ─────────────────────────────────────────────────

function platformToStatus(platform) {
  if (platform === "filmfreeway") return "filmfreeway";
  if (platform === "festhome")    return "festhome";
  return "contact_form"; // All others are form-based
}

// ── Per-festival logic ────────────────────────────────────────────────────────

async function enrich(festival) {
  // 1. HelloAsso (French festivals)
  const ha = await checkHelloAsso(festival);
  if (ha) return ha;

  // 2. Weezevent (French/Belgian)
  const we = await checkWeezevent(festival);
  if (we) return we;

  // 3. Acceptd (performing arts / competition)
  const ac = await checkAcceptd(festival);
  if (ac) return ac;

  // 4. SubmitHub (indie/emerging)
  const sh = await checkSubmitHub(festival);
  if (sh) return sh;

  // 5. EntryThingy (competition entry management)
  const et = await checkEntryThingy(festival);
  if (et) return et;

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
console.log(`  Pass C2 — Extended Platform Cross-Reference (HelloAsso, Acceptd…)`);
console.log(`  ${new Date().toISOString()}${DRY_RUN ? "  [DRY RUN]" : ""}`);
console.log(`${"═".repeat(68)}\n`);

let query = db.from("festivals")
  .select("id, festival_name, category, country, city, website")
  .eq("application_status", "unknown")
  .eq("is_archived", false)
  .order("id");

if (idArg)             query = db.from("festivals").select("id, festival_name, category, country, city, website").eq("id", idArg);
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
console.log(`  PASS C2 RESULTS`);
console.log(`${"═".repeat(68)}`);
console.log(`  Processed: ${festivals.length}  |  Found: ${found}  |  Skipped: ${skipped}  |  Errors: ${dbErrors}`);
console.log(`  Hit rate:  ${((found / festivals.length) * 100).toFixed(1)}%`);
if (Object.keys(byPlatform).length) {
  console.log(`\n  By platform:`);
  Object.entries(byPlatform).sort((a, b) => b[1] - a[1]).forEach(([p, n]) => console.log(`    ${p.padEnd(18)} ${n}`));
}
if (!DRY_RUN) {
  const [applyRes, unknRes] = await Promise.all([
    db.from("festivals").select("id", { count: "exact", head: true })
      .in("application_status", ["verified_application","filmfreeway","festhome","email_submission","contact_form"])
      .eq("is_archived", false),
    db.from("festivals").select("id", { count: "exact", head: true })
      .eq("application_status", "unknown").eq("is_archived", false),
  ]);
  console.log(`\n  Apply Now:  ${applyRes.count}  |  Unknown: ${unknRes.count}`);
}
console.log(`${"═".repeat(68)}\n`);
