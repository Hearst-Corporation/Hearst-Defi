// src/features/investor-ui/types/btc.ts
//
// BTC-screen view models. Mirrors hearst-connect-backend ReserveSummary / PerformanceSummary
// (hearst-connect-backend/src/domain/index.ts ~L154-166) redeclared as UI types.

import type { ResolvedViewModel } from "./common";

export interface BitcoinReserveViewModel {
  readonly reserveUsdc: string | null; // B3 USDC reserve, decimal string
  readonly reserveBps: number | null;
  readonly electricityCoveredMonths: number | null;
  readonly reserveBtcSats: string | null; // BTC held/accumulated, satoshis as string
  readonly reserveBtcUsd: string | null; // USD-denominated valuation of the BTC held
}

export interface PerformanceViewModel {
  readonly navPerShare: string | null;
  readonly totalReturnBps: number | null;
  readonly takeProfitProgressBps: number | null; // progress toward the take-profit trigger
  /** Estimated accumulated-BTC return, ALWAYS a range — never a single point
   *  (non-negotiable #1). Both bounds share the same unit (bps of principal). */
  readonly estimatedRangeLowBps: number | null;
  readonly estimatedRangeHighBps: number | null;
}

/**
 * Aggregated BTC-screen view model. Each block independently resolved; the
 * reserve/performance blocks are contract-owned and read NOT_CONFIGURED until
 * PermissionedDynaVault v2.1 is deployed + indexed (see CLAUDE.md #8).
 */
export interface BtcViewModel {
  readonly generatedAt: string; // ISO
  readonly reserve: ResolvedViewModel<BitcoinReserveViewModel>;
  readonly performance: ResolvedViewModel<PerformanceViewModel>;
}
