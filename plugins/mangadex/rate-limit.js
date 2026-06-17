import { sleep } from "../../lib/shared/utils.js";
import { MANGADEX_REFERER } from "./api.js";

export const REQUEST_INTERVAL_MS = 150;
export const AT_HOME_INTERVAL_MS = 1500;

/** MangaDex API returns HTTP 400 for browser-like User-Agent strings. */
export const MANGADEX_HTTP_HEADERS = {
  "User-Agent": "manga-downloader/2.0",
  Accept: "application/json",
  Referer: MANGADEX_REFERER,
};

/**
 * @param {import('../../lib/shared/http.js').HttpClient} http
 * @returns {import('../../lib/shared/http.js').HttpClient & { rawFetch: typeof fetch }}
 */
export function createMangadexHttp(http) {
  let lastRequestAt = 0;
  let lastAtHomeAt = 0;

  /**
   * @param {RequestInit} [options]
 * @returns {RequestInit}
   */
  function withMangadexHeaders(options = {}) {
    return {
      ...options,
      headers: {
        ...MANGADEX_HTTP_HEADERS,
        ...options.headers,
      },
    };
  }

  async function throttle(url) {
    const now = Date.now();
    const isAtHome = String(url).includes("/at-home/server/");
    const minGap = isAtHome ? AT_HOME_INTERVAL_MS : REQUEST_INTERVAL_MS;
    const lastAt = isAtHome ? lastAtHomeAt : lastRequestAt;
    const wait = Math.max(0, lastAt + minGap - now);
    if (wait > 0) {
      await sleep(wait);
    }
    const stamped = Date.now();
    lastRequestAt = stamped;
    if (isAtHome) {
      lastAtHomeAt = stamped;
    }
  }

  async function withThrottle(label, url, fn, max429Retries = 3) {
    let attempt = 0;
    while (true) {
      await throttle(url);
      try {
        return await fn();
      } catch (err) {
        if (err?.status === 429 && attempt < max429Retries) {
          const retryAfter = err.retryAfterMs;
          await sleep(retryAfter ?? 5000);
          attempt++;
          continue;
        }
        throw err;
      }
    }
  }

  function wrap(method, label) {
    return (url, options) =>
      withThrottle(label, url, () => http[method](url, withMangadexHeaders(options)));
  }

  return {
    fetchText: wrap("fetchText", "GET"),
    fetchJson: wrap("fetchJson", "JSON"),
    fetchBuffer: wrap("fetchBuffer", "DOWNLOAD"),
    setOnRetry: http.setOnRetry?.bind(http),
  };
}
