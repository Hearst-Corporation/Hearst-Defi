// src/lib/backend/errors.ts
//
// The single error type the backend client throws. Every failure path — HTTP
// 4xx/5xx, timeout, network drop, malformed JSON — surfaces as a BackendError.
// There is NO fixture/Prisma/legacy fallback: a backend failure is an error
// the caller must handle, never silently masked with fabricated data.

export type BackendErrorCode =
  | "timeout"
  | "network"
  | "http"
  | "parse"
  | "aborted";

export interface BackendErrorInit {
  readonly status: number | null;
  readonly code: BackendErrorCode;
  readonly requestId: string;
  readonly path: string;
  readonly cause?: unknown;
}

export class BackendError extends Error {
  readonly status: number | null;
  readonly code: BackendErrorCode;
  readonly requestId: string;
  readonly path: string;

  constructor(message: string, init: BackendErrorInit) {
    super(message, init.cause !== undefined ? { cause: init.cause } : undefined);
    this.name = "BackendError";
    this.status = init.status;
    this.code = init.code;
    this.requestId = init.requestId;
    this.path = init.path;
    Object.setPrototypeOf(this, BackendError.prototype);
  }

  /** True when retrying could plausibly help (5xx / timeout / transient network). */
  get retryable(): boolean {
    if (this.code === "timeout" || this.code === "network") return true;
    if (this.code === "http" && this.status !== null) return this.status >= 500;
    return false;
  }
}

export function isBackendError(e: unknown): e is BackendError {
  return e instanceof BackendError;
}
