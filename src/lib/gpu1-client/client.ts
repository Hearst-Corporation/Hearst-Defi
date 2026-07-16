// src/lib/gpu1-client/client.ts
//
// The ONE fetch wrapper the Connect frontend uses to reach the GPU1 business
// back-end. Works identically in Server Components, Server Actions, Route
// Handlers, and Client Components — it does nothing but HTTP.
//
// Explicit non-goals (PROMPT 219): NO fixture fallback, NO RPC fallback, NO
// legacy `src/lib/data` fallback. A GPU1 failure propagates as a GPU1Error so the
// caller renders an honest error/unavailable state — it never fabricates data.
//
// This module imports zero viem / prisma / chain code. It is a pure transport.

import { GPU1Error, type GPU1ErrorCode } from "./errors";

/** Base URL of the GPU1 back-end. Injected at build/deploy; localhost in dev. */
const BASE_URL = (
  process.env.NEXT_PUBLIC_GPU1_API_URL ?? "http://localhost:3900"
).replace(/\/+$/, "");

/** Per-request timeout budget. GPU1's own DB timeouts sit below this. */
const DEFAULT_TIMEOUT_MS = 10_000;

/** At most one retry, and only on transient failures (5xx / timeout / network). */
const MAX_RETRIES = 1;
const RETRY_BACKOFF_MS = 250;

export interface GPU1FetchOptions {
  /** HTTP method — defaults to GET. */
  readonly method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** JSON-serializable body. Serialized here; do not pre-stringify. */
  readonly body?: unknown;
  /** Extra headers (e.g. the service-to-service session token from Connect). */
  readonly headers?: Record<string, string>;
  /** Override the default 10s timeout for a specific call. */
  readonly timeoutMs?: number;
  /** Caller-owned abort signal, merged with the internal timeout signal. */
  readonly signal?: AbortSignal;
  /**
   * Next.js fetch cache hints, forwarded verbatim. Server Components can pass
   * `{ next: { revalidate: 30 } }`; the client ignores it in the browser.
   */
  readonly next?: { readonly revalidate?: number | false; readonly tags?: string[] };
  /** Force `cache: "no-store"` etc. Defaults to no-store (business data is live). */
  readonly cache?: RequestCache;
}

function newRequestId(): string {
  // crypto.randomUUID is available in Node 18+ and every modern browser.
  return crypto.randomUUID();
}

function isAbortError(e: unknown): boolean {
  return (
    e instanceof DOMException
      ? e.name === "AbortError"
      : typeof e === "object" && e !== null && (e as { name?: string }).name === "AbortError"
  );
}

/**
 * Single HTTP round-trip. Throws GPU1Error on any non-2xx / timeout / parse
 * failure. Does not retry — `gpu1Fetch` owns the retry policy.
 */
async function attempt<T>(
  path: string,
  opts: GPU1FetchOptions,
  requestId: string,
): Promise<T> {
  const url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

  // Merge the caller's signal with our timeout signal.
  const signals: AbortSignal[] = [timeoutController.signal];
  if (opts.signal) signals.push(opts.signal);
  const signal =
    signals.length === 1
      ? signals[0]
      : // AbortSignal.any is Node 20+ / modern browsers; both are targets here.
        AbortSignal.any(signals);

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: {
        accept: "application/json",
        "x-request-id": requestId,
        ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: opts.cache ?? "no-store",
      ...(opts.next ? { next: opts.next } : {}),
      signal,
    });
  } catch (cause) {
    // Distinguish "our timeout fired" from "the caller aborted" from "network".
    let code: GPU1ErrorCode = "network";
    if (isAbortError(cause)) {
      code = timeoutController.signal.aborted ? "timeout" : "aborted";
    }
    throw new GPU1Error(
      code === "timeout"
        ? `GPU1 request timed out after ${timeoutMs}ms: ${path}`
        : code === "aborted"
          ? `GPU1 request aborted by caller: ${path}`
          : `GPU1 request failed to reach ${path}`,
      { status: null, code, requestId, path, cause },
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    // Try to lift a machine reason out of the error body; never fabricate one.
    let serverCode: string | undefined;
    let serverMessage: string | undefined;
    try {
      const errBody = (await res.json()) as { code?: unknown; error?: unknown; message?: unknown };
      if (typeof errBody.code === "string") serverCode = errBody.code;
      serverMessage =
        typeof errBody.error === "string"
          ? errBody.error
          : typeof errBody.message === "string"
            ? errBody.message
            : undefined;
    } catch {
      // Non-JSON error body — leave the generic message.
    }
    throw new GPU1Error(
      `GPU1 ${res.status} on ${path}${serverMessage ? `: ${serverMessage}` : ""}`,
      { status: res.status, code: "http", requestId, path, cause: serverCode },
    );
  }

  try {
    return (await res.json()) as T;
  } catch (cause) {
    throw new GPU1Error(`GPU1 returned a non-JSON 2xx body on ${path}`, {
      status: res.status,
      code: "parse",
      requestId,
      path,
      cause,
    });
  }
}

/**
 * The public fetch primitive. One request ID per logical call (reused across the
 * single retry so GPU1 logs correlate). Retries at most once, only on transient
 * failures (5xx / timeout / network), never on a 4xx (a 4xx is a real answer).
 */
export async function gpu1Fetch<T>(path: string, opts: GPU1FetchOptions = {}): Promise<T> {
  const requestId = newRequestId();
  let lastError: GPU1Error | undefined;

  for (let attemptNo = 0; attemptNo <= MAX_RETRIES; attemptNo++) {
    try {
      return await attempt<T>(path, opts, requestId);
    } catch (e) {
      if (!(e instanceof GPU1Error)) throw e; // never swallow non-GPU1 errors
      lastError = e;
      // A caller-driven abort or a 4xx is final — do not retry.
      if (e.code === "aborted" || !e.retryable || attemptNo === MAX_RETRIES) throw e;
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS * (attemptNo + 1)));
    }
  }

  // Unreachable — the loop either returns or throws — but satisfies the type.
  throw lastError ?? new GPU1Error(`GPU1 request failed: ${path}`, {
    status: null,
    code: "network",
    requestId,
    path,
  });
}

/** The resolved base URL — exported for diagnostics/health surfaces. */
export const gpu1BaseUrl = BASE_URL;
