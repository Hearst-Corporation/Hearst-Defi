/**
 * company-assumptions.ts — explicit, traceable company/projection assumptions.
 *
 * These were previously SILENT hardcoded constants inside read-vault-apy.ts
 * (markup, revenue-share, BTC scenario band, borrow APR, fees, vault bounds).
 * They are now grouped here with EXPLICIT provenance + status so nobody mistakes
 * them for live or validated values.
 *
 * Status is deliberately CONFIGURED (not REAL): these are company hypotheses set
 * in code — NOT yet validated by a business owner, DB, admin UI, or market feed.
 * The shape mirrors how read-vault-apy.ts actually consumes them (per-vault
 * avgLtv + sleeve bounds), not an idealized schema, so wiring stays 1:1.
 *
 * Next step (P1, out of this lot): back this with a DB row / admin config / env
 * so the values become CONFIGURED-by-admin rather than CONFIGURED-in-code.
 */

import type { composeVaultApy } from "@/lib/telegram/vault-apy";

export type ProjectionAssumptionStatus =
  | "REAL"
  | "PARTIAL"
  | "FALLBACK"
  | "MOCK"
  | "CONFIGURED";

/** Per-vault bound config, fidèle à la consommation de read-vault-apy.ts. */
export interface VaultBoundConfig {
  label: string;
  /** Average maintained LTV (drives borrow-cost drag). */
  avgLtv: number;
  /** Optional per-sleeve allocation bounds (allocator format). */
  bounds?: Parameters<typeof composeVaultApy>[0]["bounds"];
}

export interface ProjectionCompanyAssumptions {
  /** Company markup on machine cost price, percent. */
  markupPct: number;
  /** Company revenue-share on net mining income, percent. */
  revenueSharePct: number;
  /** Annual borrow APR on USDC drawn against BTC collateral, percent. */
  borrowAprPct: number;
  /** Management + performance fees, percent/year. */
  feePct: number;
  /** BTC expected-return scenario band, percent. */
  btcScenarios: {
    bearPct: number;
    basePct: number;
    bullPct: number;
  };
  /** Per-vault bound config (id → config). */
  vaultBounds: Record<string, VaultBoundConfig>;
  metadata: {
    source: string;
    status: ProjectionAssumptionStatus;
    updatedAt?: string;
    notes: string[];
  };
}

/**
 * Default company assumptions — values migrated verbatim from the old silent
 * constants in read-vault-apy.ts. Status CONFIGURED: set in code, NOT validated.
 */
export const DEFAULT_PROJECTION_COMPANY_ASSUMPTIONS: ProjectionCompanyAssumptions =
  {
    markupPct: 15,
    revenueSharePct: 20,
    borrowAprPct: 6,
    feePct: 2,
    btcScenarios: { bearPct: -20, basePct: 40, bullPct: 120 },
    vaultBounds: {
      yield: { label: "Yield", avgLtv: 0.5 },
      defensive: {
        label: "Defensive",
        avgLtv: 0.4,
        bounds: { btc: [0, 15], usdc: [35, 100] },
      },
      "btc-plus": {
        label: "BTC Plus",
        avgLtv: 0.55,
        bounds: { btc: [40, 100] },
      },
    },
    metadata: {
      source: "code:src/lib/projection/company-assumptions.ts",
      status: "CONFIGURED",
      notes: [
        "Company assumptions configured in code — NOT validated by business/DB/admin UI.",
        "Do not present as live or investor-facing.",
        "P1: externalize to DB / admin config / env.",
      ],
    },
  };

/**
 * Accessor — single entry point. Today returns the in-code defaults; later this
 * is where a DB / admin / env lookup would plug in WITHOUT changing callers.
 */
export function getProjectionCompanyAssumptions(): ProjectionCompanyAssumptions {
  return DEFAULT_PROJECTION_COMPANY_ASSUMPTIONS;
}
