// gpu1-backend/src/observability/request-id.ts
import { randomUUID } from "node:crypto";

/** Reuse an inbound X-Request-Id if present + sane, else mint one. */
export function requestId(inbound: string | string[] | undefined): string {
  const v = Array.isArray(inbound) ? inbound[0] : inbound;
  if (typeof v === "string" && /^[\w-]{8,128}$/.test(v)) return v;
  return randomUUID();
}
