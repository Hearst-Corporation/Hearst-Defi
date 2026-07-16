// src/app/(product)/btc/_data/btc-page-types.ts
//
// Page-scoped SUPPLEMENTARY view models for the /btc route.
//
// A5 owns `src/features/investor-ui/types/btc.ts` (BtcViewModel: `reserve` +
// `performance` blocks only, mirroring the current gpu1-backend DTO). This
// page needs more blocks than that DTO carries today — attribution (the
// investor's economic BTC share), production, custody, event ledger, proof
// links, contextual AI experts — none of which exist yet on the
// backend/shared contract. Rather than editing A5's owned file (forbidden —
// see task brief), these EXTRA blocks live here, page-scoped, in the same
// `ResolvedViewModel<T>` shape so they compose/read identically.
//
// PROMPT 236 — the /btc surface is a BTC-only accumulation LEDGER: no return
// projection, no p5/p50/p95 bands, no take-profit mechanics. The trajectory /
// take-profit-ladder blocks were retired from this page-scoped contract; the
// engine still models take-profit internally (CLAUDE.md #6) but the investor
// surface never renders it.
//
// When gpu1-backend + A5's shared BtcViewModel grow these blocks for real,
// fold them into `features/investor-ui/types/btc.ts` and delete this file —
// the field names below were chosen to make that a rename, not a redesign.

import type { ResolvedViewModel } from "@/features/investor-ui/types/common";

/** The investor's own attributed BTC position — their economic share of the
 *  note, delivered in BTC at maturity. A per-holder figure (like a portfolio
 *  balance), NOT a fleet/operational metric. Simulated until the vault ships. */
export interface BtcAttributionViewModel {
  readonly attributedBtcSats: string; // decimal string, sats — investor's share
  readonly attributedBtcUsd: string; // decimal string, USD valuation of that share
  readonly lastVerifiedAt: string; // ISO — attribution last reconciled
}

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
  | "operational_conversion"
  | "proof_of_reserve"
  | "custody_attestation";

/** Movement status shown in the ledger. */
export type BtcEventStatus = "verified" | "confirmed" | "pending";

export interface BtcEventViewModel {
  readonly type: BtcEventType;
  readonly label: string;
  readonly occurredAt: string; // ISO
  /** Signed BTC delta for this movement, in sats. `null` for non-balance
   *  events (attestations). Positive = credited, negative = converted out. */
  readonly deltaSats: string | null;
  readonly source: string; // human label: "Mining", "Bitcoin Reserve", "Operations", "Custody"
  readonly status: BtcEventStatus;
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
  readonly attribution: ResolvedViewModel<BtcAttributionViewModel>;
  readonly production: ResolvedViewModel<BtcProductionViewModel>;
  readonly custody: ResolvedViewModel<BtcCustodyViewModel>;
  readonly events: ResolvedViewModel<readonly BtcEventViewModel[]>;
  readonly proofs: ResolvedViewModel<readonly BtcProofRefViewModel[]>;
  readonly aiExperts: readonly BtcAiExpertViewModel[];
}
