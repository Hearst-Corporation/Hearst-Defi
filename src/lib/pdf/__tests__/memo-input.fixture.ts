import "server-only";

// Test fixture: a representative `InvestorMemoInput` used by the investor-memo
// PDF template snapshot test. The production input is assembled by the
// Prisma-backed loaders in `src/lib/agents/loaders/*`; this fixture exists
// solely to exercise the PDF rendering layer deterministically. Keep the shape
// aligned with InvestorMemoInput (src/lib/agents/investor-memo.ts).
//
// Scenario / backtest retirement: the v1.0 4-sleeve scenario engine is gone.
// `loadMemoInput` now always threads `scenarios: []` and `backtests: []`, so
// this fixture mirrors that — the PDF must render honestly from the factsheet
// allocation constants (allocation-breakdown), the mining-ops loader
// (mining-health) and the monthly-history loader (performance-overview), with
// an empty-state where no verified projection exists, and NEVER off a frozen
// dead scenario.

import type { InvestorMemoInput } from "@/lib/agents/investor-memo";
import { VAULT_YIELD } from "@/lib/engine/vaults";

export function getMockMemoInput(): InvestorMemoInput {
  return {
    vault: {
      aumUsdc: 24_600_000,
      // Headline band = the vault's own engine preset (8-15% mandate), same
      // constant prod threads via loaders/vault.ts `def.apyTarget`. Hardcoding
      // a tighter 9.4-12.8 masked non-negotiables #1/#2 in the PDF snapshot.
      apyRange: {
        low: VAULT_YIELD.apyTarget.low,
        high: VAULT_YIELD.apyTarget.high,
      },
      mode: "balanced",
      riskScore: 42,
    },
    // Scenario engine retired — always empty, never a frozen 4-sleeve projection.
    scenarios: [],
    backtests: [],
    generatedAt: new Date().toISOString(),
  };
}
