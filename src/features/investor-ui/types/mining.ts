// src/features/investor-ui/types/mining.ts
//
// Mining-screen view models. Mirrors gpu1-backend MiningMetrics /
// ElectricityStatus / MiningEngineStatus (gpu1-backend/src/domain/index.ts
// ~L231-253) redeclared as UI types.

import type { ResolvedViewModel } from "./common";

export interface MiningSummaryViewModel {
  readonly reportedHashrateTh: string | null;
  readonly totalBtcEarnedSats: string | null;
  readonly lastReportTime: string | null; // ISO
  readonly currentMonth: number | null; // 1-24 of the 24-month term
  readonly productDurationMonths: number | null;
  readonly fleetActive: boolean | null;
  readonly curtailed: boolean | null;
  readonly halvingMonth: number | null;
  readonly vendingCurveBps: number | null;
}

export interface ElectricityViewModel {
  readonly monthlyCost: string | null; // USDC decimal string
  readonly payee: string | null;
  readonly totalPaid: string | null;
  readonly lastPayment: string | null; // ISO
  readonly nextEligiblePayment: string | null; // ISO
  readonly canPay: boolean | null;
}

/**
 * Aggregated mining-screen view model. Both blocks are contract-owned and
 * read NOT_CONFIGURED until v2.1 is deployed + the keeper engine is indexed.
 */
export interface MiningViewModel {
  readonly generatedAt: string; // ISO
  readonly mining: ResolvedViewModel<MiningSummaryViewModel>;
  readonly electricity: ResolvedViewModel<ElectricityViewModel>;
}
