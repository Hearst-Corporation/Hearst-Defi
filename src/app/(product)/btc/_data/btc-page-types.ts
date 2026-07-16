// src/app/(product)/btc/_data/btc-page-types.ts
//
// Page-scoped SUPPLEMENTARY view models for the /btc route.
//
// A5 owns `src/features/investor-ui/types/btc.ts` (BtcViewModel: `reserve` +
// `performance` blocks only, mirroring the current gpu1-backend DTO). This
// page needs more blocks than that DTO carries today — production,
// accumulation trajectory, take-profit ladder, custody, event timeline,
// proof links, contextual AI experts — none of which exist yet on the
// backend/shared contract. Rather than editing A5's owned file (forbidden —
// see task brief), these EXTRA blocks live here, page-scoped, in the same
// `ResolvedViewModel<T>` shape so they compose/read identically.
//
// When gpu1-backend + A5's shared BtcViewModel grow these blocks for real,
// fold them into `features/investor-ui/types/btc.ts` and delete this file —
// the field names below were chosen to make that a rename, not a redesign.

import type { ResolvedViewModel } from "@/features/investor-ui/types/common";

/** One month of mining production feeding the BTC reserve. */
export interface BtcProductionPoint {
  readonly period: string; // "2026-06"
  readonly satsEarned: string; // decimal string, sats, this month
  readonly cumulativeSatsEarned: string; // decimal string, sats — running total
}

export interface BtcProductionViewModel {
  readonly monthly: readonly BtcProductionPoint[];
  readonly cumulativeSatsEarned: string;
  readonly cumulativeBtcEarned: string; // decimal BTC string, latest running total
}

/** Accumulation trajectory — narrative + range projection. ALWAYS a range. */
export interface BtcTrajectoryViewModel {
  readonly narrative: string;
  readonly monthsElapsed: number;
  readonly monthsTotal: number; // 24-month term
  readonly projectedRangeLowPct: number;
  readonly projectedRangeHighPct: number;
  readonly methodologyVersion: string; // "v3.0"
  readonly disclaimer: string;
  readonly bands?: readonly { m: number; p5: number; p50: number; p95: number }[];
}

export interface TakeProfitTier {
  readonly tier: number;
  readonly triggerMultiple: number; // e.g. 1.3 = avg_entry x 1.30
  readonly sellPortionBps: number;
  readonly status: "pending" | "armed" | "triggered";
  readonly triggeredAt: string | null;
}

export interface BtcTakeProfitLadderViewModel {
  readonly tiers: readonly TakeProfitTier[];
}

export type BtcCustodyProvider = "fireblocks" | "unknown";

export interface BtcCustodyViewModel {
  readonly provider: BtcCustodyProvider | null;
  readonly vaultAccountId: string | null;
  readonly proofOfReserveAttestedAt: string | null;
  readonly withdrawalPolicy: string | null;
}

export type BtcEventType =
  | "mining_settlement"
  | "btc_purchase"
  | "take_profit_execution"
  | "proof_of_reserve"
  | "custody_attestation";

export interface BtcEventViewModel {
  readonly type: BtcEventType;
  readonly label: string;
  readonly occurredAt: string; // ISO
  readonly detail: string | null;
  readonly txHash: string | null;
  readonly proofHref: string | null;
}

export interface BtcProofRefViewModel {
  readonly label: string;
  readonly href: string;
  readonly kind: "por" | "mining-attestation" | "custody-attestation" | "event-log";
}

/** One contextual AI Expert rail entry — static/read-only, no chat, no
 *  autonomous action (CLAUDE.md non-negotiable #4 / ADR-012 / ADR-017). */
export interface BtcAiExpertViewModel {
  readonly id: string;
  readonly name: string;
  readonly focus: string;
  readonly summary: string;
}

/** Extra blocks this page renders alongside A5's `BtcViewModel`. */
export interface BtcPageExtraViewModel {
  readonly production: ResolvedViewModel<BtcProductionViewModel>;
  readonly trajectory: ResolvedViewModel<BtcTrajectoryViewModel>;
  readonly takeProfitLadder: ResolvedViewModel<BtcTakeProfitLadderViewModel>;
  readonly custody: ResolvedViewModel<BtcCustodyViewModel>;
  readonly events: ResolvedViewModel<readonly BtcEventViewModel[]>;
  readonly proofs: ResolvedViewModel<readonly BtcProofRefViewModel[]>;
  readonly aiExperts: readonly BtcAiExpertViewModel[];
}
