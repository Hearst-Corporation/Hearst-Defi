// src/lib/gpu1-client/errors.ts
//
// The single error type the GPU1 client throws. Every failure path — HTTP 4xx/5xx,
// timeout, network drop, malformed JSON — surfaces as a GPU1Error. There is NO
// fixture/RPC/legacy fallback: a GPU1 failure is an error the caller must handle,
// never silently masked with fabricated data.

/** Machine-readable failure reason, independent of the HTTP status. */
export type GPU1ErrorCode =
  | "timeout" // AbortController fired (request exceeded the client budget)
  | "network" // fetch rejected before any response (DNS/connection)
  | "http" // the server answered with a non-2xx status
  | "parse" // 2xx body was not the JSON shape we expected
  | "aborted"; // the caller's own signal aborted the request

export interface GPU1ErrorInit {
  readonly status: number | null;
  readonly code: GPU1ErrorCode;
  readonly requestId: string;
  readonly path: string;
  readonly cause?: unknown;
}

export class GPU1Error extends Error {
  /** HTTP status when the server answered, else null (timeout/network/parse). */
  readonly status: number | null;
  readonly code: GPU1ErrorCode;
  /** The crypto.randomUUID() sent as x-request-id — correlates client ↔ GPU1 logs. */
  readonly requestId: string;
  /** The GPU1 path that failed, e.g. "/api/v1/dashboard". */
  readonly path: string;

  constructor(message: string, init: GPU1ErrorInit) {
    super(message, init.cause !== undefined ? { cause: init.cause } : undefined);
    this.name = "GPU1Error";
    this.status = init.status;
    this.code = init.code;
    this.requestId = init.requestId;
    this.path = init.path;
    // Restore prototype chain for instanceof across transpilation targets.
    Object.setPrototypeOf(this, GPU1Error.prototype);
  }

  /** True when retrying could plausibly help (5xx / timeout / transient network). */
  get retryable(): boolean {
    if (this.code === "timeout" || this.code === "network") return true;
    if (this.code === "http" && this.status !== null) return this.status >= 500;
    return false;
  }
}

export function isGPU1Error(e: unknown): e is GPU1Error {
  return e instanceof GPU1Error;
}
