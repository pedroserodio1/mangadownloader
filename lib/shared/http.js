import { applyUserFacingFields } from "./errors.js";
import { sleep } from "./utils.js";

export const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/json,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
};

export class AppError extends Error {
  constructor(message, { retriable = false, status } = {}) {
    super(message);
    this.name = "AppError";
    this.retriable = retriable;
    this.status = status;
    this.userMessage = undefined;
    this.hint = undefined;
  }
}

export function isRetriableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

export function isNonRetriableStatus(status) {
  return status === 400 || status === 401 || status === 403 || status === 404;
}

function createAppError(message, { retriable = false, status, kind } = {}) {
  const error = new AppError(message, { retriable, status });
  return applyUserFacingFields(error, { retriable, status, kind });
}

export function createHttpClient({
  requestTimeoutMs,
  retryDelayMs,
  maxRetries,
  referer,
  logger,
  onRetry,
  verboseRetries = false,
}) {
  const baseHeaders = {
    ...DEFAULT_HEADERS,
    ...(referer ? { Referer: referer } : {}),
  };

  /** @type {((info: { attempt: number, error: AppError, delayMs: number, label: string }) => void)|null} */
  let retryHandler = onRetry ?? null;

  async function fetchWithTimeout(url, options = {}) {
    const signal = AbortSignal.timeout(requestTimeoutMs);
    let resp;

    try {
      resp = await fetch(url, {
        ...options,
        headers: { ...baseHeaders, ...options.headers },
        signal,
      });
    } catch (err) {
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        throw createAppError(`Timeout ao acessar ${url}`, {
          retriable: true,
          kind: "timeout",
        });
      }
      throw createAppError(`Falha de rede ao acessar ${url}: ${err.message}`, {
        retriable: true,
        kind: "network",
      });
    }

    if (!resp.ok) {
      const retriable = isRetriableStatus(resp.status);
      throw createAppError(`HTTP ${resp.status} ao acessar ${url}`, {
        retriable,
        status: resp.status,
      });
    }

    return resp;
  }

  async function withRetry(label, fn) {
    let attempt = 1;

    while (true) {
      try {
        return await fn();
      } catch (err) {
        const retriable = err instanceof AppError ? err.retriable : false;

        if (!retriable) {
          throw err;
        }

        if (maxRetries !== null && attempt > maxRetries) {
          throw createAppError(
            `${label}: limite de ${maxRetries} tentativas atingido — ${err.message}`,
            { retriable: false, kind: "retry_exhausted", status: err.status }
          );
        }

        if (retryHandler) {
          retryHandler({
            attempt,
            error: err,
            delayMs: retryDelayMs,
            label,
          });
        } else if (verboseRetries) {
          logger.warn(
            `${label} (tentativa ${attempt}): ${err.userMessage ?? err.message}. Retentando em ${retryDelayMs / 1000}s...`
          );
        }

        attempt++;
        await sleep(retryDelayMs);
      }
    }
  }

  const client = {
    setOnRetry(handler) {
      retryHandler = handler ?? null;
    },

    fetchText(url, options) {
      return withRetry(`GET ${url}`, async () => {
        const resp = await fetchWithTimeout(url, options);
        return resp.text();
      });
    },

    fetchJson(url, options) {
      return withRetry(`JSON ${url}`, async () => {
        const resp = await fetchWithTimeout(url, options);
        return resp.json();
      });
    },

    fetchBuffer(url, options) {
      return withRetry(`DOWNLOAD ${url}`, async () => {
        const resp = await fetchWithTimeout(url, options);
        return {
          buffer: Buffer.from(await resp.arrayBuffer()),
          headers: resp.headers,
        };
      });
    },
  };

  return client;
}
