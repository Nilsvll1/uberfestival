/**
 * Pass A2 — Aggressive multilingual BFS crawl
 *
 * Improvements over Pass A:
 *   1. Comprehensive multilingual keywords (FR, DE, ES, PT, IT, NL, Nordics, PL, HR/SR)
 *   2. Competition festival fast-path (always has applications)
 *   3. 60+ URL guess paths including non-English variants
 *   4. Subdomain guessing: apply.{domain}, forms.{domain}, submit.{domain}, etc.
 *   5. More platform detection: Acceptd, SlideRoom, HelloAsso, EntryThingy
 *   6. Homepage scoring allowed for competition-type festivals
 *   7. Looser BFS: follows more nav links, lower confidence threshold
 *
 * Usage:
 *   node --env-file=.env enrich-pass-a2.mjs
 *   node --env-file=.env enrich-pass-a2.mjs --dry-run
 *   node --env-file=.env enrich-pass-a2.mjs --limit=50
 *   node --env-file=.env enrich-pass-a2.mjs --id=42
 */

import { db }        from "./lib/supabase.mjs";
import { fetchPage } from "./lib/fetch-page.mjs";

const args     = process.argv.slice(2);
const DRY_RUN  = args.includes("--dry-run");
const limitArg = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "0", 10);
const idArg    = parseInt(args.find(a => a.startsWith("--id="))?.split("=")[1]    ?? "0", 10);

const CONCURRENCY = 3;
const DELAY_MS    = 1_200;
const sleep       = ms => new Promise(r => setTimeout(r, ms));

// ── Platform detection ────────────────────────────────────────────────────────

const PLATFORM_RE = /filmfreeway\.com|festhome\.com|submittable\.com|jotform\.com|typeform\.com|docs\.google\.com\/forms|eventival\.(?:com|eu)|wufoo\.com|formstack\.com|airtable\.com\/shr|zealous\.co\/calls|cognitoforms\.com|surveymonkey\.com\/r\/|paperform\.co|acceptd\.com|app\.slideroom\.com|helloasso\.com|entrythingy\.com|weezevent\.com|f3\.be\/form|strikingly\.com\/form|123formbuilder\.com|form\.jotform\.com|forms\.gle\//i;

function detectPlatform(url) {
  const map = [
    [/filmfreeway\.com/,             "filmfreeway"],
    [/festhome\.com/,                "festhome"],
    [/submittable\.com/,             "submittable"],
    [/jotform\.com/,                 "jotform"],
    [/typeform\.com/,                "typeform"],
    [/docs\.google\.com\/forms|forms\.gle\//,"google_forms"],
    [/eventival\.(?:com|eu)/,        "eventival"],
    [/wufoo\.com/,                   "wufoo"],
    [/formstack\.com/,               "formstack"],
    [/airtable\.com/,                "airtable"],
    [/zealous\.co/,                  "zealous"],
    [/cognitoforms\.com/,            "cognito_forms"],
    [/surveymonkey\.com/,            "surveymonkey"],
    [/paperform\.co/,                "paperform"],
    [/acceptd\.com/,                 "acceptd"],
    [/app\.slideroom\.com/,          "slideroom"],
    [/helloasso\.com/,               "helloasso"],
    [/entrythingy\.com/,             "entrythingy"],
    [/weezevent\.com/,               "weezevent"],
    [/123formbuilder\.com/,          "123formbuilder"],
  ];
  for (const [re, name] of map) if (re.test(url)) return name;
  return "official";
}

function platformToStatus(platform) {
  if (platform === "filmfreeway") return "filmfreeway";
  if (platform === "festhome")    return "festhome";
  const formPlatforms = [
    "submittable", "jotform", "typeform", "google_forms",
    "wufoo", "formstack", "airtable", "eventival", "zealous",
    "cognito_forms", "surveymonkey", "paperform",
    "acceptd", "slideroom", "helloasso", "entrythingy", "weezevent",
    "123formbuilder",
  ];
  if (formPlatforms.includes(platform)) return "contact_form";
  return "verified_application";
}

// ── Competition festival detection ────────────────────────────────────────────

// These festivals ALWAYS have applications — fast-path scoring
const COMPETITION_NAME_RE = /eisteddfod|concours|wettbewerb|competition|contest|award|prix|preis|concurso|concorso|konkurs|kermit|young musician|junior|masterclass|audition|talent/i;

// Detect competition festival by name OR if the page content is competition-focused
function isCompetitionFestival(name) {
  return COMPETITION_NAME_RE.test(name);
}

// ── Apply content detection ───────────────────────────────────────────────────

// STRONG: multi-word phrases that specifically signal artist/band applications
const STRONG_KEYWORDS = [
  // English
  /call.for.artists?/i, /open.call/i, /call.for.entr/i,
  /artist\s+application/i, /band\s+application/i, /performer\s+application/i,
  /band\s+registration/i, /performer\s+registration/i, /artist\s+registration/i,
  /music\s+submission/i, /how\s+to\s+(?:apply|submit|perform)/i,
  /want\s+to\s+perform/i, /want\s+to\s+play/i,
  /apply\s+to\s+perform/i, /apply\s+to\s+play/i,
  /submit\s+your\s+(?:act|music|band|demo|application)/i,
  /\bfor\s+artists\b/i, /\bfor\s+musicians\b/i, /\bfor\s+performers\b/i,
  /\bentry\s+form\b/i, /\baudition\b/i,
  /showcase\s+application/i, /act\s+submission/i,
  // Competition-specific English
  /enter\s+(?:the\s+)?competition/i, /competition\s+entry/i,
  /submit\s+(?:your\s+)?entry/i, /competition\s+application/i,
  /eligible\s+to\s+enter/i, /how\s+to\s+enter/i,

  // French
  /appel\s+[àa]\s+candidatures?/i, /appel\s+[àa]\s+projets?/i,
  /appel\s+[àa]\s+participation/i, /candidature\s+ouverte/i,
  /soumettre\s+(?:votre\s+)?candidature/i, /formulaire\s+de\s+candidature/i,
  /pour\s+les\s+artistes/i, /comment\s+participer/i,
  /inscription\s+ouverte/i, /d[ée]p[oô]t\s+de\s+candidature/i,
  /appel\s+[àa]\s+artistes?/i, /appel\s+[àa]\s+musiciens?/i,

  // German
  /bewerbung(?:sformular)?/i, /k[üu]nstler(?:bewerbung|-anmeldung)/i,
  /f[üu]r\s+k[üu]nstler/i, /f[üu]r\s+musiker/i, /mitmachen\s+(?:als|bei)/i,
  /bewerben\s+sie\s+sich/i, /jetzt\s+bewerben/i, /ausschreibung/i,
  /einreichung\s+von/i, /bewerbungsstart/i, /teilnahmeformular/i,
  /wettbewerb\s+(?:anmeldung|teilnahme|einreichung)/i,

  // Spanish
  /convocatoria\s+(?:de\s+)?artistas?/i, /convocatoria\s+abierta/i,
  /formulario\s+de\s+inscripci[oó]n/i, /c[oó]mo\s+participar/i,
  /inscr[ií]bete/i, /env[ií]a\s+tu\s+propuesta/i, /solicitar\s+participaci[oó]n/i,
  /para\s+artistas/i, /para\s+m[uú]sicos/i, /para\s+bandas/i,
  /presenta\s+tu\s+(?:banda|grupo|propuesta)/i,

  // Portuguese
  /inscri[çc][ãa]o\s+(?:de\s+)?artistas/i, /formul[áa]rio\s+de\s+inscri[çc][ãa]o/i,
  /como\s+participar/i, /submeter\s+candidatura/i, /candidature\s+aberta/i,
  /inscri[çc][ãa]o\s+aberta/i, /para\s+artistas/i, /para\s+m[uú]sicos/i,
  /enviar\s+proposta/i,

  // Italian
  /candidatura\s+aperta/i, /modulo\s+di\s+(?:iscrizione|candidatura)/i,
  /come\s+partecipare/i, /iscrizione\s+artisti/i, /per\s+(?:gli\s+)?artisti/i,
  /per\s+(?:i\s+)?musicisti/i, /bando\s+(?:di\s+)?partecipazione/i,
  /invia\s+la\s+(?:tua\s+)?candidatura/i,

  // Dutch
  /inschrijving(?:sformulier)?\s+(?:voor\s+)?artiest/i, /voor\s+artiesten/i,
  /hoe\s+(?:kun|kan)\s+(?:je|u)\s+meedoen/i, /aanmelden\s+als\s+artiest/i,
  /open\s+call\s+(?:voor|muzikanten)/i,

  // Nordic (Swedish/Danish/Norwegian)
  /ans[öo]kan\s+(?:f[öo]r\s+)?artister/i, /f[öo]r\s+artister\b/i,
  /ans[öo]k\s+(?:nu|h[äa]r)/i, /anm[äa]lan\s+(?:f[öo]r\s+)?artister/i,
  /s[øo]k\s+(?:om\s+)?[åa]\s+spille/i, /deltag[ae]\s+som\s+artist/i,

  // Polish
  /zg[łl]oszenie\s+artyst/i, /dla\s+artyst[oó]w/i, /dla\s+muzykant[oó]w/i,
  /formularz\s+(?:zg[łl]oszeniowy|rejestracyjny)/i, /nab[oó]r\s+artyst/i,

  // Croatian/Serbian
  /prijava\s+(?:za\s+)?izvo[đd]a[čc]e/i, /natje[čc]aj\s+(?:za\s+)?artiste/i,
  /kako\s+se\s+prijaviti/i, /prijavite\s+se/i,
];

// WEAK: generic words that need multiple hits to matter
const WEAK_KEYWORDS = [
  // English
  /\bapply\b/i, /\bapplication\b/i, /\bsubmit\b/i, /\bsubmission\b/i,
  /\bperform\b/i, /\bshowcase\b/i, /\bregistration\b/i,
  // Multilingual generic
  /\bpostuler\b/i, /\bcandidature\b/i, /\bcandidat\b/i, /\binscription\b/i, // French
  /\bbewerb/i, /\banmeld/i, /\bteilnahm/i, /\beinreich/i,                    // German
  /\bcandidatura\b/i, /\binscripci[oó]n\b/i, /\bparticipar\b/i,              // ES/PT/IT
  /\binscri[çc][ãa]o\b/i, /\bpartecipare\b/i,                                // PT/IT
  /\binschrijving\b/i, /\baanmeld/i, /\bdeelnem/i,                           // NL
  /\bans[öo]k/i, /\banm[äa]l/i, /\bdeltag/i,                                 // Nordic
  /\bzg[łl]oszen/i, /\brejestracja\b/i,                                       // PL
  /\bprijava\b/i, /\bnatje[čc]aj\b/i, /\bprijavit/i,                         // HR/SR
];

// Pages that are definitely not artist applications
const BAD_PAGE_RE = /\/ticket(s|ing|-office)?|\/buy(-tickets)?|\/shop(\/|$)|\/store(\/|$)|\/media(\/|$)|\/press(\/|$)|\/news\/|\/(2\d{3})\/|\/login|\/signin|\/sign-in|\/connexion|\/billetterie|\/membership|\/trader(s)?(\/|$)|\/vendor(s)?(\/|$)|\/contact(-us)?(\/|$)|\/contact\.html|\/sponsor|\/partner|\/volunteer|\/accessibility|\/privacy|\/cookie|\/terms|\/imprint|\/impressum|\/datenschutz|\/about(\/|$)|\/history(\/|$)|\/gallery|\/photos|\/video/i;

function isHomepage(url) {
  try {
    const { pathname } = new URL(url);
    return pathname === "/" || pathname === "" || pathname === "/index.html" ||
           /^\/(?:en|fr|de|es|it|nl|pl|hr|sr|pt|nb|sv|da)\/?$/i.test(pathname);
  } catch { return false; }
}

function scoreApplyPage(url, html, { festivalName = "", isCompetition = false } = {}) {
  if (BAD_PAGE_RE.test(url)) return null;
  // Skip homepages unless it's a competition festival that might have entry info on homepage
  if (isHomepage(url) && !isCompetition) return null;

  const platform = detectPlatform(url);
  if (platform !== "official") return { url, platform, confidence: 0.88 };

  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 20_000);
  const strongHits = STRONG_KEYWORDS.filter(p => p.test(text)).length;
  const weakHits   = WEAK_KEYWORDS.filter(p => p.test(text)).length;
  const hasForm    = /<form\b/i.test(html);

  // Lowered threshold for competition festivals
  if (isCompetition) {
    if (strongHits >= 1)          return { url, platform, confidence: 0.80 };
    if (hasForm && weakHits >= 2) return { url, platform, confidence: 0.72 };
  }

  if (strongHits >= 1 && hasForm)      return { url, platform, confidence: 0.82 };
  if (strongHits >= 2)                 return { url, platform, confidence: 0.78 };
  if (strongHits >= 1 && weakHits >= 2) return { url, platform, confidence: 0.74 };
  if (hasForm && weakHits >= 3)        return { url, platform, confidence: 0.72 };
  return null;
}

// ── Link extraction for BFS ───────────────────────────────────────────────────

const APPLY_URL_RE = /\/apply|\/applications?|\/submit|\/submissions?|\/call-for-|\/open-call|\/entries|\/entry|\/audition|\/for-artists|\/for-bands|\/perform|\/participate|\/registration|\/showcase|\/musicians|\/performers|\/bands|\/take-part|\/get-involved|\/join|\/programme|\/candidature|\/postuler|\/inscription|\/bewerb|\/anmeld|\/mitmach|\/teilnahm|\/einreich|\/convocatoria|\/inscripcion|\/candidatura|\/iscrizione|\/inschrijving|\/aanmeld|\/ansokan|\/ans[öo]k|\/zgloszen|\/rejestracja|\/prijava|\/natjecaj/i;
const APPLY_TEXT_RE = /\bapply\b|\bapplication\b|\bsubmit\b|\bopen.call\b|\bcall.for\b|\baudition\b|\bperform\b|\bparticipate\b|\bregistration\b|\bshowcase\b|\bget.involved\b|\bfor.artists\b|\bjoin.us\b|\btake.part\b|\bcandidature\b|\bpostuler\b|\binscription\b|\bbewerb|\banmeld|\bmitmach|\bconvocatoria\b|\bcandidatura\b|\binscripci[oó]n\b|\biscrizione\b|\binschrijving\b|\baanmeld|\bdeltag|\bans[öo]k|\bprijava\b|\bnatje[čc]aj\b/i;

function scoreLinkForApply(href, text) {
  let s = 0;
  if (APPLY_URL_RE.test(href))  s += 20;
  if (APPLY_TEXT_RE.test(text)) s += 15;
  if (PLATFORM_RE.test(href))   s += 40;
  return s;
}

function extractLinks(html, baseUrl, festivalHost, { minScore = 0, max = 40 } = {}) {
  const seen = new Set();
  const links = [];
  const re = /<a\s[^>]*href=["']([^"'#][^"']*?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const [, href, rawText] = m;
    const text = rawText.replace(/<[^>]+>/g, "").trim();
    if (!href || /^(mailto:|tel:|javascript:)/i.test(href)) continue;
    try {
      const abs = new URL(href, baseUrl).href;
      if (seen.has(abs)) continue;
      seen.add(abs);
      const rHost = new URL(abs).hostname.replace(/^www\./, "");
      const isSameDomain = rHost === festivalHost || rHost.endsWith("." + festivalHost);
      const isPlatform   = PLATFORM_RE.test(abs);
      if (!isSameDomain && !isPlatform) continue;
      if (BAD_PAGE_RE.test(abs)) continue;
      const score = scoreLinkForApply(href, text);
      if (score >= minScore || isPlatform) links.push({ url: abs, score, isPlatform, text });
    } catch {}
  }
  return links.sort((a, b) => b.score - a.score)
    .filter((_, i) => i < max);
}

// ── Slug generation ───────────────────────────────────────────────────────────

function slugs(name) {
  const base = name.toLowerCase()
    .replace(/[''`]/g, "").replace(/&/g, "and")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
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
  ])].filter(Boolean);
}

// ── URL path guessing ─────────────────────────────────────────────────────────

const GUESS_PATHS = [
  // Core English
  "/apply", "/applications", "/submission", "/submissions",
  "/open-call", "/call-for-entries", "/call-for-artists",
  "/for-artists", "/for-musicians", "/for-performers",
  "/artists/apply", "/artists/registration", "/artists/submission",
  "/submit", "/entries", "/entry",
  // Participation
  "/participate", "/take-part", "/get-involved", "/join-us", "/join",
  "/perform", "/play", "/showcase",
  // Registration
  "/register", "/registration", "/artist-registration",
  "/band-registration", "/performer-registration",
  // Showcase / programme / audition
  "/showcase-submission", "/showcase-application", "/programme/apply",
  "/programme/submissions", "/programme/artists", "/auditions", "/audition",
  // French
  "/candidature", "/soumettre", "/participer", "/postuler",
  "/appel-a-candidatures", "/appel-a-artistes", "/appel-a-participation",
  "/inscription", "/inscriptions", "/comment-participer",
  // German
  "/bewerben", "/bewerbung", "/mitmachen", "/teilnahme", "/einreichen",
  "/fuer-kuenstler", "/fuer-musiker", "/kuenstler-anmeldung",
  "/jetzt-bewerben", "/teilnahmeformular", "/ausschreibung",
  // Spanish
  "/convocatoria", "/inscripcion", "/inscripciones", "/como-participar",
  "/para-artistas", "/para-musicos", "/solicitar",
  // Portuguese
  "/inscricao", "/candidatura-artistas", "/como-participar",
  "/para-artistas", "/submeter-candidatura",
  // Italian
  "/iscrizione", "/candidatura", "/come-partecipare", "/per-artisti",
  "/modulo-iscrizione", "/bando",
  // Dutch
  "/inschrijving", "/aanmelden", "/meedoen", "/voor-artiesten",
  // Nordic (Swedish/Danish/Norwegian)
  "/ansokan", "/anmalan", "/anmeld", "/soknad", "/deltaga",
  "/for-artister", "/for-musikere",
  // Polish
  "/zgloszenie", "/rejestracja", "/dla-artystow",
  // Croatian/Serbian
  "/prijava", "/natjecaj", "/prijavite-se",
  // Competition-specific
  "/competition/entry", "/competition/enter", "/enter-competition",
  "/competition-entry", "/how-to-enter",
];

async function guessUrlPaths(festival, baseUrl, { isCompetition = false } = {}) {
  const origin = (() => { try { return new URL(baseUrl).origin; } catch { return null; } })();
  if (!origin) return null;
  const festivalHost = new URL(baseUrl).hostname.replace(/^www\./, "");

  const results = await Promise.all(
    GUESS_PATHS.map(async path => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4_000);
        const res = await fetch(origin + path, {
          method: "HEAD", redirect: "follow", signal: ctrl.signal,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; UberFestivalBot/1.0)" },
        }).finally(() => clearTimeout(t));
        if (!res.ok) return null;
        return res.url || origin + path;
      } catch { return null; }
    })
  );

  for (const url of results.filter(Boolean)) {
    if (BAD_PAGE_RE.test(url)) continue;
    const rHost = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; } })();
    const isSameDomain = rHost === festivalHost || rHost?.endsWith("." + festivalHost);
    if (!isSameDomain && detectPlatform(url) === "official") continue;
    const { html } = await fetchPage(url, { retries: 0, timeoutMs: 8_000 });
    if (!html) continue;
    const scored = scoreApplyPage(url, html, { festivalName: festival.festival_name, isCompetition });
    if (scored) return { ...scored, source: `a2_guess:${url}` };
  }
  return null;
}

// ── Subdomain guessing ────────────────────────────────────────────────────────

async function checkSubdomains(festival, baseUrl) {
  const festivalHost = (() => { try { return new URL(baseUrl).hostname.replace(/^www\./, ""); } catch { return null; } })();
  if (!festivalHost) return null;

  const subdomains = ["apply", "forms", "submit", "registration", "signup", "entries", "entry"];
  const results = await Promise.all(
    subdomains.map(async sub => {
      const url = `https://${sub}.${festivalHost}`;
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4_000);
        const res = await fetch(url, {
          method: "HEAD", redirect: "follow", signal: ctrl.signal,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; UberFestivalBot/1.0)" },
        }).finally(() => clearTimeout(t));
        if (!res.ok) return null;
        // Make sure it didn't redirect to a generic page
        const finalHost = (() => { try { return new URL(res.url).hostname; } catch { return ""; } })();
        if (finalHost !== `${sub}.${festivalHost}` && !finalHost.endsWith(festivalHost)) return null;
        return res.url;
      } catch { return null; }
    })
  );

  for (const url of results.filter(Boolean)) {
    const platform = detectPlatform(url);
    if (platform !== "official") return { url, platform, confidence: 0.85, source: `a2_subdomain:${url}` };
    const { html } = await fetchPage(url, { retries: 0, timeoutMs: 8_000 });
    if (!html) continue;
    const scored = scoreApplyPage(url, html, { festivalName: festival.festival_name });
    if (scored) return { ...scored, source: `a2_subdomain:${url}` };
  }
  return null;
}

// ── Submittable subdomain check ───────────────────────────────────────────────

async function checkSubmittable(festival) {
  for (const s of slugs(festival.festival_name).slice(0, 5)) {
    const url = `https://${s}.submittable.com`;
    try {
      const { html, finalUrl } = await fetchPage(url, { retries: 0, timeoutMs: 6_000 });
      if (!html) continue;
      if (!finalUrl?.includes("submittable.com")) continue;
      if (finalUrl.includes("submittable.com/p/") || finalUrl === "https://submittable.com/") continue;
      return { url: finalUrl || url, platform: "submittable", confidence: 0.85, source: "a2_submittable" };
    } catch { continue; }
  }
  return null;
}

// ── Acceptd check (performing arts applications) ──────────────────────────────

async function checkAcceptd(festival) {
  for (const s of slugs(festival.festival_name).slice(0, 4)) {
    const url = `https://app.acceptd.com/programs?search=${encodeURIComponent(festival.festival_name.slice(0, 30))}`;
    try {
      const { html } = await fetchPage(url, { retries: 0, timeoutMs: 6_000 });
      if (!html) continue;
      const text = html.toLowerCase();
      const nameWords = festival.festival_name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const matchCount = nameWords.filter(w => text.includes(w)).length;
      if (matchCount >= 2) {
        // Find the direct link
        const linkRe = new RegExp(`href="(https://app\\.acceptd\\.com/programs/[^"]+)"`, "i");
        const m = html.match(linkRe);
        const acceptdUrl = m ? m[1] : `https://app.acceptd.com/programs?q=${encodeURIComponent(festival.festival_name)}`;
        return { url: acceptdUrl, platform: "acceptd", confidence: 0.78, source: "a2_acceptd" };
      }
    } catch { continue; }
  }
  return null;
}

// ── BFS crawl ─────────────────────────────────────────────────────────────────

async function bfsCrawl(festival, baseUrl) {
  const isCompetition = isCompetitionFestival(festival.festival_name);
  const festivalHost = (() => { try { return new URL(baseUrl).hostname.replace(/^www\./, ""); } catch { return null; } })();
  if (!festivalHost) return null;

  const { html: homeHtml, finalUrl } = await fetchPage(baseUrl, { retries: 1, timeoutMs: 10_000 });
  if (!homeHtml) return null;

  const effectiveBase = finalUrl || baseUrl;

  // Level 0a: platform links directly on homepage
  const homeLinks = extractLinks(homeHtml, effectiveBase, festivalHost, { minScore: 0, max: 50 });
  for (const l of homeLinks.filter(l => l.isPlatform)) {
    return { url: l.url, platform: detectPlatform(l.url), confidence: 0.85, source: "a2_home_platform" };
  }

  // Level 0b: score homepage itself if competition festival
  if (isCompetition) {
    const homeScored = scoreApplyPage(effectiveBase, homeHtml, { festivalName: festival.festival_name, isCompetition: true });
    if (homeScored) return { ...homeScored, source: `a2_home_competition:${effectiveBase}` };
  }

  // Level 1a: follow high-scoring links from homepage (likely apply/participate pages)
  for (const l of homeLinks.filter(l => l.score >= 20)) {
    const { html } = await fetchPage(l.url, { retries: 0, timeoutMs: 8_000 });
    if (!html) continue;
    const scored = scoreApplyPage(l.url, html, { festivalName: festival.festival_name, isCompetition });
    if (scored) return { ...scored, source: `a2_high:${l.url}` };
    // Platform links on this sub-page
    const subLinks = extractLinks(html, l.url, festivalHost, { minScore: 0, max: 20 });
    for (const sl of subLinks.filter(sl => sl.isPlatform)) {
      return { url: sl.url, platform: detectPlatform(sl.url), confidence: 0.82, source: "a2_sub_platform" };
    }
  }

  // Level 1b: BFS over all nav/menu/footer links from homepage
  const navLinks = homeLinks.filter(l => l.score < 20 && !l.isPlatform).slice(0, 20);
  for (const l of navLinks) {
    const { html: subHtml } = await fetchPage(l.url, { retries: 0, timeoutMs: 7_000 });
    if (!subHtml) continue;

    const scored = scoreApplyPage(l.url, subHtml, { festivalName: festival.festival_name, isCompetition });
    if (scored?.confidence >= 0.72) return { ...scored, source: `a2_bfs:${l.url}` };

    const subLinks = extractLinks(subHtml, l.url, festivalHost, { minScore: 15, max: 10 });
    for (const sl of subLinks) {
      if (sl.isPlatform) return { url: sl.url, platform: detectPlatform(sl.url), confidence: 0.82, source: "a2_bfs_platform" };
      const { html: deepHtml } = await fetchPage(sl.url, { retries: 0, timeoutMs: 6_000 });
      if (!deepHtml) continue;
      const deepScored = scoreApplyPage(sl.url, deepHtml, { festivalName: festival.festival_name, isCompetition });
      if (deepScored?.confidence >= 0.72) return { ...deepScored, source: `a2_bfs2:${sl.url}` };
    }
  }

  return null;
}

// ── Per-festival logic ────────────────────────────────────────────────────────

async function enrich(festival) {
  const baseUrl = festival.website?.startsWith("http")
    ? festival.website
    : festival.website ? `https://${festival.website}` : null;

  const isCompetition = isCompetitionFestival(festival.festival_name);

  // 1. BFS crawl (includes homepage for competition festivals)
  if (baseUrl) {
    const crawl = await bfsCrawl(festival, baseUrl);
    if (crawl) return crawl;
  }

  // 2. URL path guessing (expanded with multilingual paths)
  if (baseUrl) {
    const guess = await guessUrlPaths(festival, baseUrl, { isCompetition });
    if (guess) return guess;
  }

  // 3. Subdomain guessing (apply.domain.com, forms.domain.com)
  if (baseUrl) {
    const sub = await checkSubdomains(festival, baseUrl);
    if (sub) return sub;
  }

  // 4. Submittable subdomain
  const subm = await checkSubmittable(festival);
  if (subm) return subm;

  // 5. Acceptd (for performing arts / competition festivals)
  if (isCompetition || festival.category === "Competition") {
    const acceptd = await checkAcceptd(festival);
    if (acceptd) return acceptd;
  }

  return null;
}

// ── DB write ──────────────────────────────────────────────────────────────────

async function saveResult(festival, result) {
  const appStatus = platformToStatus(result.platform);
  const { error } = await db.from("festivals").update({
    application_url:         result.url,
    application_platform:    result.platform,
    application_source:      result.source?.slice(0, 200),
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
console.log(`  Pass A2 — Aggressive Multilingual BFS Crawl`);
console.log(`  ${new Date().toISOString()}${DRY_RUN ? "  [DRY RUN]" : ""}`);
console.log(`${"═".repeat(68)}\n`);

let query = db.from("festivals")
  .select("id, festival_name, category, country, website")
  .eq("application_status", "unknown")
  .eq("is_archived", false)
  .not("website", "is", null)
  .order("id");

if (idArg)             query = db.from("festivals").select("id, festival_name, category, country, website").eq("id", idArg);
if (limitArg && !idArg) query = query.limit(limitArg);

const { data: festivals, error } = await query;
if (error)              { console.error("[FATAL]", error.message); process.exit(1); }
if (!festivals?.length) { console.log("  No targets remaining.\n"); process.exit(0); }

console.log(`  Targets: ${festivals.length} unknown festivals`);
console.log(`  Competition fast-path: ${festivals.filter(f => isCompetitionFestival(f.festival_name)).length} festivals\n`);

let found = 0, skipped = 0, dbErrors = 0;
const byPlatform = {}, bySource = {};

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
    const src = result.source?.split(":")[0] ?? "unknown";
    bySource[src] = (bySource[src] ?? 0) + 1;
    console.log(`  ✓ ${label} [${result.platform.padEnd(14)}] conf=${result.confidence.toFixed(2)}  ${result.url.slice(0, 55)}`);

    if (DRY_RUN) return;

    const dbErr = await saveResult(festival, result);
    if (dbErr) { console.warn(`    [warn] DB write failed: ${dbErr.message}`); dbErrors++; found--; }
  }));

  if (i + CONCURRENCY < festivals.length) await sleep(DELAY_MS);
}

console.log(`\n${"═".repeat(68)}`);
console.log(`  PASS A2 RESULTS`);
console.log(`${"═".repeat(68)}`);
console.log(`  Processed: ${festivals.length}  |  Found: ${found}  |  Skipped: ${skipped}  |  DB errors: ${dbErrors}`);
console.log(`  Hit rate:  ${((found / festivals.length) * 100).toFixed(1)}%`);
if (Object.keys(byPlatform).length) {
  console.log(`\n  By platform:`);
  Object.entries(byPlatform).sort((a, b) => b[1] - a[1]).forEach(([p, n]) => console.log(`    ${p.padEnd(18)} ${n}`));
}
if (Object.keys(bySource).length) {
  console.log(`\n  By source:`);
  Object.entries(bySource).sort((a, b) => b[1] - a[1]).forEach(([s, n]) => console.log(`    ${s.padEnd(24)} ${n}`));
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
