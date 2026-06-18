const USER_AGENT =
  "Mozilla/5.0 (compatible; UberFestivalBot/1.0; +https://uberfestival.com)";

/**
 * Fetches a URL and returns its HTML text.
 * Returns null on failure rather than throwing, so the caller can decide
 * how to mark the record.
 *
 * @param {string} url
 * @param {{ retries?: number, timeoutMs?: number }} opts
 * @returns {Promise<{ html: string|null, status: number|null, error: string|null, finalUrl: string }>}
 */
export async function fetchPage(url, { retries = 2, timeoutMs = 12_000 } = {}) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(2000 * attempt); // back off between retries

    // Hard wall-clock cap on top of AbortController. Some hangs (e.g. a DNS
    // lookup or connect that never settles) aren't reliably cancelled by
    // an AbortSignal on every platform/Node version — without this, one bad
    // host can stall a whole batch indefinitely. The abandoned attempt is
    // left to be GC'd; we just stop waiting on it.
    let outcome;
    try {
      outcome = await withHardTimeout(attemptFetch(url, timeoutMs), timeoutMs + 5_000);
    } catch {
      outcome = { type: "retry", error: "HardTimeout" };
    }

    if (outcome.type === "success") {
      return { html: outcome.html, status: outcome.status, error: null, finalUrl: outcome.finalUrl };
    }
    if (outcome.type === "final") {
      return { html: null, status: outcome.status, error: outcome.error, finalUrl: outcome.finalUrl };
    }
    lastError = outcome.error;
  }

  return { html: null, status: null, error: lastError ?? "Unknown error", finalUrl: url };
}

// ── One fetch attempt ─────────────────────────────────────────────────────────

async function attemptFetch(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // NB: fetch() resolves once headers arrive — it does NOT wait for the
    // body. The same `timer` must stay armed through res.text() below, or
    // a server that holds the connection open mid-body hangs forever with
    // nothing to abort it.
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      // 4xx errors are final — don't retry.
      if (res.status >= 400 && res.status < 500) {
        return { type: "final", status: res.status, error: `HTTP ${res.status}`, finalUrl: res.url };
      }
      return { type: "retry", error: `HTTP ${res.status}` };
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
      return { type: "final", status: res.status, error: "Not HTML", finalUrl: res.url };
    }

    const html = await res.text();
    return { type: "success", html, status: res.status, finalUrl: res.url };
  } catch (err) {
    return { type: "retry", error: err.name === "AbortError" ? "Timeout" : String(err.message) };
  } finally {
    clearTimeout(timer);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function withHardTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("HardTimeout")), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
