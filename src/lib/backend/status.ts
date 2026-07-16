// src/lib/backend/status.ts
//
// Helpers to render a Resolved<T> / envelope status honestly. Centralized so
// no widget re-implements "what does NOT_CONFIGURED mean" differently.

import type { DataStatus, EnvelopeStatus } from "./contracts";

/** True when the value is safe to read (LIVE/STALE/PARTIAL all carry a value). */
export function hasValue(status: DataStatus): boolean {
  return status === "LIVE" || status === "STALE" || status === "PARTIAL";
}

const DATA_STATUS_LABEL: Record<DataStatus, string> = {
  LIVE: "Live",
  STALE: "Stale",
  PARTIAL: "Partial",
  UNAVAILABLE: "Unavailable",
  NOT_CONFIGURED: "Not configured",
  NOT_SUPPORTED: "Not supported",
  PERMISSION_DENIED: "Permission denied",
};

export function dataStatusLabel(status: DataStatus): string {
  return DATA_STATUS_LABEL[status];
}

const ENVELOPE_STATUS_LABEL: Record<EnvelopeStatus, string> = {
  LIVE: "Live",
  SNAPSHOT: "Snapshot",
  STALE: "Stale",
  SIMULATED: "Simulated",
  NOT_CONFIGURED: "Not configured",
  UNAVAILABLE: "Unavailable",
};

export function envelopeStatusLabel(status: EnvelopeStatus): string {
  return ENVELOPE_STATUS_LABEL[status];
}
