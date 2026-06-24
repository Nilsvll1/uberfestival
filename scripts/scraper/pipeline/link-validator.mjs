/**
 * Application Link Validator — pipeline module.
 *
 * Exported: validateApplicationLinks(db, reporter, runId, dryRun, opts)
 *
 * For each festival with an application_url:
 *   1. HTTP probe → classify result
 *   2. If broken → attempt recovery (crawl festival website, try FilmFreeway slug)
 *   3. Write link_check_status, link_check_at, etc. to the festivals row
 *   4. Append an audit row to application_link_checks
 *
 * Status values written to festivals.link_check_status:
 *   ok                 — 200, page is a valid apply page
 *   not_found          — 4xx response
 *   redirect_unrelated — redirects to an unrelated external domain
 *   parked             — domain is parked for sale
 *   login_wall         — page requires login, no visible apply content
 *   expired            — page says submissions are closed
 *   dead_domain        — DNS failure / connection refused
 *   timeout            — request timed out
 *   error              — unexpected error
 *
 * Called by:
 *   pipeline/run.mjs               (Phase E, weekly batch of ~150)
 *   scripts/validate-apply-links.mjs  (standalone full-sweep CLI)
 */

import { fetchPage } from "../lib/fetch-page.mjs";

const USER_AGENT = "Mozilla/5.0 (compatible; UberFestivalBot/1.0; +https://uberfestival.com)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Detection: parked domains ─────────────────────────────────────────────────

const PARKED_HOSTS = new Set([
  "sedo.com", "godaddy.com", "afternic.com", "parkingcrew.net",
  "bodis.com", "hugedomains.com", "dan.com", "undeveloped.com",
  "domainmarket.com", "namefind.com", "registrar.tucows.com", "buydomains.com",
]);

const PARKED_SIGNALS = [
  /this domain is (for sale|available|parked)/i,
  /buy this domain/i,
  /domain for sale/i,
  /this web site is for sale/i,
  /domain parking/i,
  /parked by/i,
  /the domain has expired/i,
  /register this domain/i,
  /domain may be for sale/i,
];

// ── Detection: login walls ────────────────────────────────────────────────────

const LOGIN_SIGNALS = [
  /please (sign in|log in|login|create an account) to/i,
  /you must (be logged in|sign in|log in)/i,
  /login required/i,
  /sign in to (view|access|apply|submit)/i,
  /create an account to (apply|submit|access)/i,
];

// ── Detection: expired / closed submissions ───────────────────────────────────

const EXPIRED_SIGNALS = [
  /submissions?\s+(are\s+)?(now\s+)?closed/i,
  /no longer accepting (submissions?|applications?|entries)/i,
  /applications?\s+(are\s+)?closed/i,
  /registration\s+(is|are)\s+closed/i,
  /deadline has passed/i,
  /this year'?s? (submissions?|applications?) (have|has) (closed|ended)/i,
  /call for entr\S+ (is|has been) closed/i,
];

// Domains that are always valid redirect targets (submission platforms)
const KNOWN_PLATFORMS = /filmfreeway\.com|festhome\.com|submittable\.com|jotform\.com|typeform\.com|docs\.google\.com\/forms|eventival\.com|wufoo\.com|formstack\.com|airtable\.com\/shr/i;

// ── URL check helpers ─────────────────────────────────────────────────────────

function isUnrelatedRedirect(originalUrl, finalUrl) {
  try {
    const orig = new URL(originalUrl);
    const final = new URL(finalUrl);
    if (orig.hostname === final.hostname) return false;
    const origRoot = orig.hostname.split(".").slice(-2).join(".");
    const finalRoot = final.hostname.split(".").slice(-2).join(".");
    if (origRoot === finalRoot) return false;
    if (KNOWN_PLATFORMS.test(finalUrl)) return false;
    return true;
  } catch { return false; }
}

function isParked(html, finalUrl) {
  try {
    const host = new URL(finalUrl).hostname;
    if ([...PARKED_HOSTS].some((h) => host === h || host.endsWith("." + h))) return true;
  } catch {}
  if (!html) return false;
  const text = html.replace(/<[^>]+>/g, " ").slice(0, 3000);
  return PARKED_SIGNALS.some((p) => p.test(text));
}

function isLoginWall(html) {
  if (!html) return false;
  const text = html.replace(/<[^>]+>/g, " ").slice(0, 5000);
  if (!LOGIN_SIGNALS.some((p) => p.test(text))) return false;
  const hasApply = /apply|submit|submission|open call|call for/i.test(text);
  return !hasApply;
}

function isExpired(html) {
  if (!html) return false;
  const text = html.replace(/<[^>]+>/g, " ").slice(0, 6000);
  return EXPIRED_SIGNALS.some((p) => p.test(text));
}

// ── HTTP probe ────────────────────────────────────────────────────────────────

async function checkUrl(url) {
  const { html, status, error, finalUrl } = await fetchPage(url, { retries: 1, timeoutMs: 12_000 });

  // Network-level failure (DNS, timeout, connection refused)
  if (!status && error) {
    const isTimeout = /timeout/i.test(error);
    return {
      checkStatus: isTimeout ? "timeout" : "dead_domain",
      httpStatus: null,
      redirectUrl: null,
      notes: error,
    };
  }

  // 404 / 410 / other 4xx
  if (status === 404 || status === 410) {
    return { checkStatus: "not_found", httpStatus: status, redirectUrl: finalUrl ?? null };
  }
  if (status && status >= 400 && status < 500) {
    return { checkStatus: "not_found", httpStatus: status, redirectUrl: finalUrl ?? null };
  }

  // 5xx
  if (status && status >= 500) {
    return { checkStatus: "error", httpStatus: status, redirectUrl: finalUrl ?? null };
  }

  // Non-HTML 200 (PDF form, direct file download) — treat as OK
  if (status === 200 && html === null && error === "Not HTML") {
    return { checkStatus: "ok", httpStatus: 200, redirectUrl: finalUrl ?? null };
  }

  // 200 with HTML — content analysis
  if (status === 200 && html) {
    if (finalUrl && isUnrelatedRedirect(url, finalUrl)) {
      return {
        checkStatus: "redirect_unrelated",
        httpStatus: 200,
        redirectUrl: finalUrl,
        notes: `→ ${finalUrl}`,
      };
    }
    if (isParked(html, finalUrl ?? url)) {
      return { checkStatus: "parked", httpStatus: 200, redirectUrl: finalUrl ?? null };
    }
    if (isLoginWall(html)) {
      return { checkStatus: "login_wall", httpStatus: 200, redirectUrl: finalUrl ?? null };
    }
    if (isExpired(html)) {
      return { checkStatus: "expired", httpStatus: 200, redirectUrl: finalUrl ?? null };
    }
    return { checkStatus: "ok", httpStatus: 200, redirectUrl: finalUrl ?? null };
  }

  return {
    checkStatus: "error",
    httpStatus: status ?? null,
    redirectUrl: finalUrl ?? null,
    notes: error ?? "Unknown",
  };
}

// ── Recovery ──────────────────────────────────────────────────────────────────

function nameAppearsOnPage(html, name) {
  if (!name || !html) return false;
  const words = name.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  if (!words.length) return true;
  const text = html.toLowerCase();
  return words.filter((w) => text.includes(w)).length >= Math.ceil(words.length * 0.5);
}

function toSlug(name) {
  return (name ?? "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function tryFilmFreeway(festival) {
  const slug = toSlug(festival.festival_name);
  const candidates = [slug, slug.replace(/-festival$/, ""), slug + "-festival"];

  for (const s of candidates) {
    const url = `https://filmfreeway.com/${s}`;
    try {
      const res = await Promise.race([
        fetch(url, { headers: { "User-Agent": USER_AGENT }, redirect: "follow" }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 8000)),
      ]);
      if (!res.ok || !res.url.includes("filmfreeway.com/")) continue;
      const html = await res.text();
      if (!nameAppearsOnPage(html, festival.festival_name)) continue;
      return { url: res.url, source: "filmfreeway" };
    } catch { continue; }
  }
  return null;
}

async function crawlWebsiteForApplyLink(festival) {
  if (!festival.website) return null;
  const { html } = await fetchPage(festival.website, { retries: 0, timeoutMs: 10_000 });
  if (!html) return null;

  const APPLY_URL = /\/apply(?:\/|$|-)|\/applications?(?:\/|$)|\/submit(?:\/|$)|\/call-for-|\/open-call|\/entries/i;
  const APPLY_TEXT = /\bapply\b|\bsubmit\b|\bapplication\b|\bcall.for\b|\bopen.call\b|\baudition\b/i;

  const linkRe = /<a\s[^>]*href=["']([^"'#][^"']*?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let best = null;
  let m;

  while ((m = linkRe.exec(html)) !== null) {
    const [, href, rawText] = m;
    const text = rawText.replace(/<[^>]+>/g, "").trim();
    const urlScore = APPLY_URL.test(href) ? 20 : 0;
    const textScore = APPLY_TEXT.test(text) ? 15 : 0;
    if (urlScore + textScore < 15) continue;
    try {
      const abs = new URL(href, festival.website).href;
      if (!best || urlScore + textScore > best.score) {
        best = { url: abs, score: urlScore + textScore };
      }
    } catch {}
  }

  if (!best) return null;

  try {
    const res = await Promise.race([
      fetch(best.url, { method: "HEAD", headers: { "User-Agent": USER_AGENT }, redirect: "follow" }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 6000)),
    ]);
    if (!res.ok) return null;
    return { url: res.url ?? best.url, source: "festival_website" };
  } catch { return null; }
}

async function attemptRecovery(festival) {
  const crawl = await crawlWebsiteForApplyLink(festival);
  if (crawl) return crawl;

  const ff = await tryFilmFreeway(festival);
  if (ff) return ff;

  return null;
}

// ── Main exported function ────────────────────────────────────────────────────

const BROKEN_STATUSES = new Set([
  "not_found", "redirect_unrelated", "parked", "dead_domain", "timeout", "error",
]);

/**
 * @param {object}  db          Supabase service-role client
 * @param {object}  reporter    Pipeline reporter (may be null for standalone runs)
 * @param {number}  runId       pipeline_runs.id (may be null for standalone runs)
 * @param {boolean} dryRun      Skip all DB writes when true
 * @param {object}  opts
 * @param {number}  opts.limit        Max festivals to check this run (default 150)
 * @param {number}  opts.concurrency  Parallel probes (default 3)
 * @param {string}  opts.statusFilter Only check festivals with this link_check_status
 * @param {number}  opts.festivalId   Single festival override
 */
export async function validateApplicationLinks(
  db,
  reporter,
  runId,
  dryRun = false,
  { limit = 150, concurrency = 3, statusFilter = null, festivalId = null } = {},
) {
  let query = db
    .from("festivals")
    .select("id, festival_name, application_url, website, link_check_status")
    .not("application_url", "is", null)
    .eq("is_archived", false);

  if (festivalId) {
    query = query.eq("id", festivalId);
  } else if (statusFilter) {
    query = query.eq("link_check_status", statusFilter).limit(limit);
  } else {
    // Priority: unchecked (NULL link_check_at) first, then oldest checked
    query = query
      .order("link_check_at", { ascending: true, nullsFirst: true })
      .limit(limit);
  }

  const { data: festivals, error } = await query;
  if (error) throw new Error(`Link validator query failed: ${error.message}`);

  if (!festivals?.length) {
    console.log("  [link-validator] No festivals to check.");
    return { checked: 0, broken: 0, recovered: 0 };
  }

  console.log(`\n── Phase E: Application Link Validation (${festivals.length} URLs)`);

  let checked = 0, broken = 0, recovered = 0, dbErrors = 0;

  for (let i = 0; i < festivals.length; i += concurrency) {
    const batch = festivals.slice(i, i + concurrency);

    await Promise.all(batch.map(async (festival) => {
      const url = festival.application_url;
      const label = festival.festival_name.slice(0, 52);
      console.log(`  [check] ${label}`);

      let result;
      try {
        result = await checkUrl(url);
      } catch (err) {
        result = { checkStatus: "error", httpStatus: null, redirectUrl: null, notes: String(err.message) };
      }

      checked++;
      const isOk = result.checkStatus === "ok";
      const isBroken = BROKEN_STATUSES.has(result.checkStatus);

      if (!isOk) {
        console.log(`    → ${result.checkStatus}${result.notes ? ` (${result.notes.slice(0, 60)})` : ""}`);
      }
      if (isBroken) broken++;

      // Recovery attempt for broken URLs
      let recoveryUrl = null;
      let recoverySource = null;
      const recoveryAttempted = isBroken;

      if (isBroken) {
        const recovery = await attemptRecovery(festival);
        if (recovery) {
          recoveryUrl = recovery.url;
          recoverySource = recovery.source;
          recovered++;
          console.log(`    → recovered via ${recovery.source}: ${recovery.url.slice(0, 58)}`);
        }
      }

      if (dryRun) {
        console.log(`    [dry] status=${result.checkStatus} recovery=${recoveryUrl ?? "none"}`);
        return;
      }

      const now = new Date().toISOString();

      const update = {
        link_check_status: result.checkStatus,
        link_check_at: now,
        link_check_http_status: result.httpStatus,
      };
      if (isOk) update.link_last_ok_at = now;
      if (recoveryUrl) update.application_url_secondary = recoveryUrl;

      const { error: upErr } = await db.from("festivals").update(update).eq("id", festival.id);
      if (upErr) {
        console.warn(`    [warn] DB update failed id=${festival.id}: ${upErr.message}`);
        dbErrors++;
      }

      await db.from("application_link_checks").insert({
        festival_id: festival.id,
        url,
        url_slot: "primary",
        status: result.checkStatus,
        http_status: result.httpStatus,
        redirect_url: result.redirectUrl,
        recovery_attempted: recoveryAttempted,
        recovery_url: recoveryUrl,
        recovery_source: recoverySource,
        notes: result.notes ?? null,
        checked_at: now,
      });
    }));

    if (i + concurrency < festivals.length) await sleep(800);
  }

  const summary = `Link validation: ${checked} checked, ${broken} broken, ${recovered} recovered, ${dbErrors} DB errors`;
  console.log(`\n  ${summary}`);
  if (reporter && runId) {
    reporter.log(runId, broken > 0 ? "warn" : "info", "phase_e", summary);
  }

  return { checked, broken, recovered };
}
