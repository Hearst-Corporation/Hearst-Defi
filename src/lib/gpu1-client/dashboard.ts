// src/lib/gpu1-client/dashboard.ts
//
// Dashboard vertical slice — the ONE end-to-end domain this pass (M3). One call
// returns the whole screen's data as a DashboardDTO; the DTO's own Resolved<T>
// wrappers carry per-field status/provenance/freshness, so the UI never guesses.

import { gpu1Fetch } from "./client";
import type { DashboardDTO } from "./schemas";

/** GET /api/v1/dashboard — the aggregated investor dashboard. */
export function getDashboard(): Promise<DashboardDTO> {
  return gpu1Fetch<DashboardDTO>("/api/v1/dashboard");
}
