// src/lib/gpu1-client/schemas.ts
//
// Canonical domain TYPES for the frontend client. The single source of truth is
// `gpu1-backend/src/domain` — we re-export it so the client and the API can never
// drift. These are `import type` re-exports: the `@/*` alias maps to `./src/*` and
// does NOT cover `gpu1-backend/`, so we reach it with a relative path. Because it
// is TYPE-ONLY, TypeScript erases it at compile time — no runtime coupling, no
// bundling of backend code into the browser.
//
// ── FRAGILITY WARNING ────────────────────────────────────────────────────────
// The relative hop `../../../gpu1-backend/src/domain` is computed from
// src/lib/gpu1-client/ (three levels up reaches the repo root). If either the
// client folder or the domain file moves, this path breaks at typecheck. It is
// tolerable because it is type-only and `gpu1-backend/src/domain/index.ts` is a
// single-owner file. If it ever becomes a maintenance problem, replace this file
// with locally-declared interfaces mirroring the DTOs (the client would then own
// a copy of the contract). Prefer keeping the import while the path holds.

export type {
  // Provenance / honesty primitives
  SourceProvenance,
  DataStatus,
  DataFreshness,
  Resolved,
  // Vault
  VaultCapacity,
  VaultSnapshot,
  PocketId,
  VaultStrategy,
  VaultUserPosition,
  // Mining / electricity / engine
  MiningMetrics,
  ElectricityStatus,
  MiningEngineStatus,
  // Events
  VaultEventName,
  VaultEvent,
  // Runtime / contract status
  ContractRuntimeMode,
  ContractRuntimeStatus,
  // Aggregated view DTOs
  DashboardDTO,
} from "../../../gpu1-backend/src/domain";
