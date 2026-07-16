// src/lib/backend/client.ts
//
// The ONE fetch wrapper the Connect frontend uses to reach hearst-connect-backend
// (independent repository, independent deploy). Works identically in Server
// Components, Server Actions, Route Handlers, and Client Components — it does
// nothing but HTTP.
//
// Explicit non-goals: NO fixture fallback, NO Prisma/legacy `src/lib/data`
// fallback. A backend failure propagates as a BackendError so the caller
// renders an honest error/unavailable state — it never fabricates data.
//
// This module imports zero prisma / chain code. It is a pure transport.

import { BackendError, type BackendErrorCode } from "./errors";

/**
 * Base URL of the backend. NEXT_PUBLIC_BACKEND_URL is used when this code
 * runs in the browser (Client Components); BACKEND_INTERNAL_URL is preferred
 * server-side when set (e.g. a private network address unreachable from the
 * public internet) — see docs/backend-integration.md. Both fall back to
 * localhost:3900 in dev. Neither variable carries a secret.
 */
function resolveBaseUrl(): string {
  const internal = typeof window === "undefined" ? process.env.BACKEND_INTERNAL_URL : undefined;
  const raw = internal || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3900";
  return raw.replace(/\/+$/, "");
}

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 1;
const RETRY_BACKOFF_MS = 250;

export interface BackendFetchOptions {
  readonly method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly next?: { readonly revalidate?: number | false; readonly tags?: string[] };
  readonly cache?: RequestCache;
}

function newRequestId(): string {
  return crypto.randomUUID();
}

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException
    ? e.name === "AbortError"
    : typeof e === "object" && e !== null && (e as { name?: string }).name === "AbortError";
}

async function attempt<T>(path: string, opts: BackendFetchOptions, requestId: string): Promise<T> {
  const baseUrl = resolveBaseUrl();
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

  const signals: AbortSignal[] = [timeoutController.signal];
  if (opts.signal) signals.push(opts.signal);
  const signal = signals.length === 1 ? signals[0] : AbortSignal.any(signals);

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
    let code: BackendErrorCode = "network";
    if (isAbortError(cause)) {
      code = timeoutController.signal.aborted ? "timeout" : "aborted";
    }
    throw new BackendError(
      code === "timeout"
        ? `Backend request timed out after ${timeoutMs}ms: ${path}`
        : code === "aborted"
          ? `Backend request aborted by caller: ${path}`
          : `Backend request failed to reach ${path}`,
      { status: null, code, requestId, path, cause },
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
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
    throw new BackendError(
      `Backend ${res.status} on ${path}${serverMessage ? `: ${serverMessage}` : ""}`,
      { status: res.status, code: "http", requestId, path, cause: serverCode },
    );
  }

  try {
    return (await res.json()) as T;
  } catch (cause) {
    throw new BackendError(`Backend returned a non-JSON 2xx body on ${path}`, {
      status: res.status,
      code: "parse",
      requestId,
      path,
      cause,
    });
  }
}

/**
 * The public fetch primitive. One request ID per logical call (reused across
 * the single retry so backend logs correlate). Retries at most once, only on
 * transient failures (5xx / timeout / network), never on a 4xx.
 */
export async function backendFetch<T>(path: string, opts: BackendFetchOptions = {}): Promise<T> {
  const requestId = newRequestId();
  let lastError: BackendError | undefined;

  for (let attemptNo = 0; attemptNo <= MAX_RETRIES; attemptNo++) {
    try {
      return await attempt<T>(path, opts, requestId);
    } catch (e) {
      if (!(e instanceof BackendError)) throw e;
      lastError = e;
      if (e.code === "aborted" || !e.retryable || attemptNo === MAX_RETRIES) throw e;
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS * (attemptNo + 1)));
    }
  }

  throw lastError ?? new BackendError(`Backend request failed: ${path}`, {
    status: null,
    code: "network",
    requestId,
    path,
  });
}

/** The resolved base URL — exported for diagnostics/health surfaces. */
export const backendBaseUrl = resolveBaseUrl;
