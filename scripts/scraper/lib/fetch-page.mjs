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

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      });

      clearTimeout(timer);

      if (!res.ok) {
        // 4xx errors are final — don't retry.
        if (res.status >= 400 && res.status < 500) {
          return { html: null, status: res.status, error: `HTTP ${res.status}`, finalUrl: res.url };
        }
        lastError = `HTTP ${res.status}`;
        continue;
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("html")) {
        return { html: null, status: res.status, error: "Not HTML", finalUrl: res.url };
      }

      const html = await res.text();
      return { html, status: res.status, error: null, finalUrl: res.url };
    } catch (err) {
      lastError = err.name === "AbortError" ? "Timeout" : String(err.message);
    }
  }

  return { html: null, status: null, error: lastError ?? "Unknown error", finalUrl: url };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
