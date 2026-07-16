// src/lib/gpu1-client/admin.ts
//
// Admin domain (M-later). Scaffolded ahead of its GPU1 endpoint. No canonical
// admin DTO exists in gpu1-backend/src/domain yet, so `AdminDTO` is a minimal
// LOCAL placeholder (operator overview). Reuses ContractRuntimeStatus +
// VaultCapacity from the domain so runtime/capacity are never re-typed. Replace
// with the domain DTO once it is promoted.
//
// Auth note: admin calls carry the service-to-service session token minted by
// Connect; GPU1 validates it and derives the role itself (it NEVER trusts a role
// asserted by the frontend). The client only forwards the token via `headers`.

import { gpu1Fetch, type GPU1FetchOptions } from "./client";
import type { ContractRuntimeStatus, Resolved, VaultCapacity } from "./schemas";

/** LOCAL placeholder for the admin overview DTO until it lands in the domain contract. */
export interface AdminDTO {
  readonly runtime: ContractRuntimeStatus;
  readonly capacity: Resolved<VaultCapacity>;
  /** Total assets under management, USDC decimal string. */
  readonly aumUsdc: Resolved<string>;
  /** Count of whitelisted investors. */
  readonly investorCount: Resolved<number>;
}

/**
 * GET /api/v1/admin/overview — operator overview.
 * Pass the Connect-minted session token via `opts.headers` (Authorization);
 * GPU1 validates it and enforces the admin role server-side.
 */
export function getAdmin(opts?: Pick<GPU1FetchOptions, "headers" | "signal">): Promise<AdminDTO> {
  return gpu1Fetch<AdminDTO>("/api/v1/admin/overview", opts);
}
