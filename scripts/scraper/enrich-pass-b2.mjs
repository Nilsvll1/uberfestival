/**
 * Pass B2 — Native-language DuckDuckGo search
 *
 * Improvements over Pass B:
 *   1. Country-aware query generation (French, German, Spanish, Portuguese, Italian queries)
 *   2. Competition-specific search terms
 *   3. Platform-expanded search (Acceptd, HelloAsso, Weezevent, Zealous)
 *   4. Smarter result scoring (prefers exact name match in URL/title)
 *
 * Usage:
 *   node --env-file=.env enrich-pass-b2.mjs
 *   node --env-file=.env enrich-pass-b2.mjs --dry-run
 *   node --env-file=.env enrich-pass-b2.mjs --limit=200
 */

import { db }        from "./lib/supabase.mjs";
import { fetchPage } from "./lib/fetch-page.mjs";

const args     = process.argv.slice(2);
const DRY_RUN  = args.includes("--dry-run");
const limitArg = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "0", 10);
const idArg    = parseInt(args.find(a => a.startsWith("--id="))?.split("=")[1]    ?? "0", 10);

const DELAY_MS = 3_500;
const sleep    = ms => new Promise(r => setTimeout(r, ms));

const PLATFORM_RE = /filmfreeway\.com|festhome\.com|submittable\.com|jotform\.com|typeform\.com|docs\.google\.com\/forms|zealous\.co\/calls|helloasso\.com|weezevent\.com|acceptd\.com|app\.slideroom\.com|eventival\.(?:com|eu)|cognitoforms\.com|surveymonkey\.com\/r\//i;

const SKIP_DOMAINS = /songkick\.com|ticketmaster\.|livenation\.|bandsintown\.|setlist\.fm|wikipedia\.|wikidata\.|facebook\.com|instagram\.com|twitter\.com|youtube\.com|spotify\.com|apple\.com|google\.com\/search|bing\.com|reddit\.com|discogs\.com|last\.fm|musicbrainz\.org|eventbrite\.com|festicket\.com|efestivals\.co\.uk/i;

function detectPlatform(url) {
  const map = [
    [/filmfreeway\.com/,           "filmfreeway"],
    [/festhome\.com/,              "festhome"],
    [/submittable\.com/,           "submittable"],
    [/jotform\.com/,               "jotform"],
    [/typeform\.com/,              "typeform"],
    [/docs\.google\.com\/forms|forms\.gle\//, "google_forms"],
    [/zealous\.co/,                "zealous"],
    [/helloasso\.com/,             "helloasso"],
    [/weezevent\.com/,             "weezevent"],
    [/acceptd\.com/,               "acceptd"],
    [/app\.slideroom\.com/,        "slideroom"],
    [/eventival\.(?:com|eu)/,      "eventival"],
    [/cognitoforms\.com/,          "cognito_forms"],
    [/surveymonkey\.com/,          "surveymonkey"],
  ];
  for (const [re, name] of map) if (re.test(url)) return name;
  return "official";
}

function platformToStatus(platform) {
  if (platform === "filmfreeway") return "filmfreeway";
  if (platform === "festhome")    return "festhome";
  const formPlatforms = ["submittable","jotform","typeform","google_forms","zealous","helloasso","weezevent","acceptd","slideroom","eventival","cognito_forms","surveymonkey"];
  if (formPlatforms.includes(platform)) return "contact_form";
  return "verified_application";
}

// ── Country → language mapping ────────────────────────────────────────────────

const COUNTRY_LANG = {
  France: "fr", Belgium: "fr", Switzerland: "fr", Canada: "fr", Luxembourg: "fr",
  Germany: "de", Austria: "de",
  Spain: "es", Mexico: "es", Argentina: "es", Colombia: "es", Chile: "es",
  Peru: "es", Venezuela: "es", Ecuador: "es", Uruguay: "es", Bolivia: "es",
  Portugal: "pt", Brazil: "pt",
  Italy: "it",
  Netherlands: "nl",
  Sweden: "sv", Denmark: "da", Norway: "no", Finland: "fi",
  Poland: "pl",
  Croatia: "hr", Serbia: "sr", Slovenia: "sl",
  Romania: "ro",
  Czech_Republic: "cs", Czechia: "cs", Slovakia: "sk",
  Hungary: "hu",
  Greece: "el",
};

// Native-language apply verbs for query generation
const APPLY_TERMS_BY_LANG = {
  fr: ["candidature", "postuler", "inscription artiste", "appel à candidatures"],
  de: ["bewerben", "Bewerbung", "Künstler anmelden", "mitmachen"],
  es: ["convocatoria", "inscripción artistas", "como participar", "candidatura"],
  pt: ["inscrição artistas", "candidatura", "como participar"],
  it: ["candidatura artisti", "iscrizione", "come partecipare", "bando"],
  nl: ["inschrijving artiest", "aanmelden", "meedoen"],
  sv: ["ansökan", "för artister", "anmälan"],
  da: ["ansøgning", "for kunstnere", "tilmelding"],
  no: ["søknad", "for artister", "påmelding"],
  pl: ["zgłoszenie artysty", "rejestracja", "dla artystów"],
  hr: ["prijava", "natječaj za izvođače"],
  sr: ["prijava", "konkurs za izvođače"],
};

// ── Query generation ──────────────────────────────────────────────────────────

const COMPETITION_NAME_RE = /eisteddfod|concours|wettbewerb|competition|contest|award|prix|preis|concurso|concorso|konkurs|young musician|junior|masterclass|audition|talent/i;

function buildQueries(festival) {
  const name = festival.festival_name;
  const lang = COUNTRY_LANG[festival.country] ?? "en";
  const isCompetition = COMPETITION_NAME_RE.test(name);

  const queries = [
    // Query 1: platform-specific (always)
    `"${name}" filmfreeway OR festhome OR submittable OR helloasso OR zealous apply`,
    // Query 2: native language participation
    lang === "en" || !APPLY_TERMS_BY_LANG[lang]
      ? `"${name}" apply musicians performers artists 2025 2026`
      : `"${name}" ${APPLY_TERMS_BY_LANG[lang][0]} 2025 2026`,
    // Query 3: open call / competition specific
    isCompetition
      ? `"${name}" entry competition "how to enter" OR "submit entry" OR "competition rules"`
      : `"${name}" "open call" OR "call for entries" OR "artist application" OR "how to apply"`,
  ];

  // Extra query for non-English festivals: English platform search
  if (lang !== "en" && APPLY_TERMS_BY_LANG[lang]) {
    queries.push(`"${name}" ${APPLY_TERMS_BY_LANG[lang][1] ?? APPLY_TERMS_BY_LANG[lang][0]}`);
  }

  return queries.slice(0, 4);
}

// ── DuckDuckGo search ─────────────────────────────────────────────────────────

const DDG_HREF_RE = /href="(https?:\/\/[^"]+)"/gi;
const DDG_UDDG_RE = /uddg=(https?[^&"]+)/gi;

async function searchDDG(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=wt-wt`;
  try {
    const { html } = await fetchPage(url, { retries: 1, timeoutMs: 12_000 });
    if (!html) return [];

    const urls = new Set();
    // Method 1: result__a class hrefs
    const linkRe = /<a[^>]+class="result__a"[^>]*href="([^"]+)"/gi;
    let m;
    while ((m = linkRe.exec(html)) !== null) {
      try { urls.add(decodeURIComponent(m[1])); } catch { urls.add(m[1]); }
    }
    // Method 2: uddg= redirect params
    while ((m = DDG_UDDG_RE.exec(html)) !== null) {
      try { urls.add(decodeURIComponent(m[1])); } catch {}
    }
    return [...urls];
  } catch { return []; }
}

// ── Page verification ─────────────────────────────────────────────────────────

const APPLY_STRONG_RE = /call.for.artists?|open.call|artist\s+application|band\s+application|performer\s+application|music\s+submission|appel\s+[àa]\s+candidatures?|candidature\s+ouverte|bewerbung(?:sformular)?|convocatoria\s+(?:de\s+)?artistas?|formulario\s+de\s+inscripci[oó]n|modulo\s+di\s+iscrizione|inschrijving(?:sformulier)?\s+(?:voor\s+)?artiest|ans[öo]kan\s+(?:f[öo]r\s+)?artister|zg[łl]oszenie\s+artyst|prijava\s+(?:za\s+)?izvo[đd]a[čc]e|competition\s+entry|submit\s+(?:your\s+)?entry|how\s+to\s+enter/i;

async function confirmApplyPage(url, festivalName) {
  try {
    const { html } = await fetchPage(url, { retries: 0, timeoutMs: 8_000 });
    if (!html) return false;
    const text = html.replace(/<[^>]+>/g, " ").slice(0, 20_000);
    // Must have at least one strong keyword
    if (!APPLY_STRONG_RE.test(text)) return false;
    // Prefer: festival name appears somewhere on the page
    const nameWords = festivalName.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const textLower = text.toLowerCase();
    return nameWords.some(w => textLower.includes(w));
  } catch { return false; }
}

// ── URL scoring ───────────────────────────────────────────────────────────────

function scoreResultUrl(url, festivalName) {
  const lower = url.toLowerCase();
  const nameParts = festivalName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  let score = 0;
  if (PLATFORM_RE.test(url))             score += 100;
  if (lower.includes(nameParts))         score += 30;
  if (/\/apply|\/submission|\/entries|\/open-call|\/candidature|\/bewerb|\/inscripci|\/candidatura|\/iscrizione|\/inschrijving|\/entry/i.test(lower)) score += 20;
  return score;
}

// ── Per-festival search ───────────────────────────────────────────────────────

async function search(festival) {
  const queries = buildQueries(festival);
  const seen = new Set();
  const candidates = [];

  for (const query of queries) {
    await sleep(DELAY_MS + Math.random() * 1_000);
    const results = await searchDDG(query);

    for (const url of results) {
      if (seen.has(url) || SKIP_DOMAINS.test(url)) continue;
      seen.add(url);

      const platform = detectPlatform(url);

      // Platform hit: require name slug appears in URL for specificity
      if (platform !== "official") {
        const nameSlug = festival.festival_name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
        const urlLower = url.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!urlLower.includes(nameSlug.slice(0, 6))) continue;
        candidates.push({ url, platform, score: scoreResultUrl(url, festival.festival_name), source: "b2_platform" });
      } else {
        // Official URL: check it's not the festival's own homepage
        try {
          const festHost = festival.website ? new URL(festival.website.startsWith("http") ? festival.website : `https://${festival.website}`).hostname.replace(/^www\./, "") : null;
          const urlHost  = new URL(url).hostname.replace(/^www\./, "");
          const isFestivalSite = festHost && (urlHost === festHost || urlHost.endsWith("." + festHost));
          if (isFestivalSite) {
            candidates.push({ url, platform: "official", score: scoreResultUrl(url, festival.festival_name), source: "b2_official", needsVerify: true });
          }
          // External official pages are unlikely to be application pages unless they look like it
        } catch {}
      }
    }
  }

  // Sort by score, verify best candidates
  candidates.sort((a, b) => b.score - a.score);

  for (const c of candidates.slice(0, 5)) {
    if (c.platform !== "official") {
      return { url: c.url, platform: c.platform, confidence: 0.82, source: c.source };
    }
    if (c.needsVerify) {
      const ok = await confirmApplyPage(c.url, festival.festival_name);
      if (ok) return { url: c.url, platform: "official", confidence: 0.76, source: "b2_official_verified" };
    }
  }

  return null;
}

// ── DB write ──────────────────────────────────────────────────────────────────

async function saveResult(festival, result) {
  const appStatus = platformToStatus(result.platform);
  const { error } = await db.from("festivals").update({
    application_url:         result.url,
    application_platform:    result.platform,
    application_source:      result.source,
    application_confidence:  result.confidence,
    application_verified_at: new Date().toISOString(),
    booking_model:           "open_call",
    application_status:      appStatus,
    link_check_status:       "unchecked",
  }).eq("id", festival.id);
  return error;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(68)}`);
console.log(`  Pass B2 — Native-Language DuckDuckGo Search`);
console.log(`  ${new Date().toISOString()}${DRY_RUN ? "  [DRY RUN]" : ""}`);
console.log(`${"═".repeat(68)}\n`);
console.log(`  ⚠  Sequential with 3.5s+ delay — expect 90+ min for full run.\n`);

let query = db.from("festivals")
  .select("id, festival_name, category, country, website")
  .eq("application_status", "unknown")
  .eq("is_archived", false)
  .order("id");

if (idArg)             query = db.from("festivals").select("id, festival_name, category, country, website").eq("id", idArg);
if (limitArg && !idArg) query = query.limit(limitArg);

const { data: festivals, error } = await query;
if (error)              { console.error("[FATAL]", error.message); process.exit(1); }
if (!festivals?.length) { console.log("  No targets remaining.\n"); process.exit(0); }

console.log(`  Targets: ${festivals.length} unknown festivals\n`);

let found = 0, skipped = 0, dbErrors = 0;
const byPlatform = {};

for (let i = 0; i < festivals.length; i++) {
  const festival = festivals[i];
  const label = `[${String(festival.id).padStart(4)}] ${festival.festival_name.slice(0, 44).padEnd(44)}`;
  process.stdout.write(`  … ${label} [${i+1}/${festivals.length}]\r`);

  let result;
  try { result = await search(festival); }
  catch (err) {
    console.log(`  ✗ ${label} ERROR: ${err.message.slice(0, 60)}`);
    skipped++;
    continue;
  }

  if (!result) { skipped++; continue; }

  found++;
  byPlatform[result.platform] = (byPlatform[result.platform] ?? 0) + 1;
  console.log(`  ✓ ${label} [${result.platform.padEnd(14)}] conf=${result.confidence.toFixed(2)}  ${result.url.slice(0, 50)}`);

  if (!DRY_RUN) {
    const dbErr = await saveResult(festival, result);
    if (dbErr) { console.warn(`    [warn] DB write failed: ${dbErr.message}`); dbErrors++; found--; }
  }
}

console.log(`\n${"═".repeat(68)}`);
console.log(`  PASS B2 RESULTS`);
console.log(`${"═".repeat(68)}`);
console.log(`  Processed: ${festivals.length}  |  Found: ${found}  |  Skipped: ${skipped}  |  DB errors: ${dbErrors}`);
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
