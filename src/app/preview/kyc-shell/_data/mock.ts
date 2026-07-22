/**
 * Static placeholder data for the KYC shell preview.
 *
 * Shapes mirror the real dashboard view-model so the ported KYC composition
 * renders identically without any data source. No fetch, no Prisma, no RPC.
 */

import type { AccumulationPoint } from "@/features/investor-ui/charts/accumulation-series";
import type { MiningInterval } from "@/features/investor-ui/components/reserve-cockpit";

export const SERIES1 = {
  fullName: "Reserve Vault Overview",
  meta: "As of 12 Jun 2026, 09:00 UTC · Methodology v3.0",
  description:
    "A single investor register for capital deployment, accumulated Bitcoin, reserve coverage, mining operations and proof readiness.",
} as const;

/** Hero + KPI band — same 1 hero + 6 metrics rhythm as the real dashboard. */
export const HERO = {
  label: "BTC accumulated",
  value: "12.482310 BTC",
  hint: "Attributed accumulation across the current Series 1 term",
} as const;

export const KPI_METRICS = [
  { label: "Capital deployed", value: "$21.8M", hint: "Investor position" },
  { label: "Reserve runway", value: "14.2 mo", hint: "B3 Reserve USDC coverage" },
  { label: "Mining state", value: "Active", hint: "Current reporting window" },
  { label: "Term progress", value: "11/24", hint: "Months elapsed" },
  { label: "Contract", value: "Read", hint: "Base Sepolia" },
  { label: "Proof status", value: "Reported", hint: "Source provenance below" },
] as const;

/** Position summary rows — the 4 strategy signals of the real dashboard. */
export const STRATEGY_SIGNALS = [
  ["DCA discipline", "On track"],
  ["Reserve management", "Strong"],
  ["Execution quality", "Excellent"],
  ["Accumulation pace", "Advancing"],
] as const;

export const VERDICT_DETAIL = "4 of 4 strategy signals in a positive state.";

/** Policy allocation — Series 1 canon 40 / 27 / 33. */
export const ALLOCATION_POCKETS = [
  { pocket: "B1", label: "Mining Power", pct: 40 },
  { pocket: "B2", label: "BTC Pouch", pct: 27 },
  { pocket: "B3", label: "Reserve USDC", pct: 33 },
] as const;

/** Capital flow rail — same 4 ordered steps as the real dashboard. */
export const CAPITAL_FLOW_STEPS = [
  "USDC subscription",
  "B1 / B2 / B3 allocation",
  "BTC reserve ledger",
  "BTC delivery at maturity",
] as const;

/** Accumulation series feeding the real AccumulationChartSignature. */
export const ACCUMULATION_POINTS: readonly AccumulationPoint[] = [
  { period: "2025-08", cumulativeBtc: 1.021, miningBtc: 0.729 },
  { period: "2025-09", cumulativeBtc: 2.184, miningBtc: 1.56 },
  { period: "2025-10", cumulativeBtc: 3.402, miningBtc: 2.43 },
  { period: "2025-11", cumulativeBtc: 4.735, miningBtc: 3.382 },
  { period: "2025-12", cumulativeBtc: 6.011, miningBtc: 4.294 },
  { period: "2026-01", cumulativeBtc: 7.268, miningBtc: 5.191 },
  { period: "2026-02", cumulativeBtc: 8.44, miningBtc: 6.029 },
  { period: "2026-03", cumulativeBtc: 9.617, miningBtc: 6.869 },
  { period: "2026-04", cumulativeBtc: 10.72, miningBtc: 7.657 },
  { period: "2026-05", cumulativeBtc: 11.63, miningBtc: 8.307 },
  { period: "2026-06", cumulativeBtc: 12.4823, miningBtc: 8.916 },
] as const;

export const TERM = { currentMonth: 11, totalMonths: 24 } as const;

/** Reserve runway — feeds the real ReserveRunwayChart. */
export const RUNWAY_DATA = {
  points: [
    { period: "2026-02", coverageMonths: 11.4 },
    { period: "2026-03", coverageMonths: 12.1 },
    { period: "2026-04", coverageMonths: 13.0 },
    { period: "2026-05", coverageMonths: 13.6 },
    { period: "2026-06", coverageMonths: 14.2 },
  ],
  floorMonths: 6,
} as const;

/** Mining intervals — feeds the real MiningActivityTimeline. */
export const MINING_INTERVALS: readonly MiningInterval[] = [
  { label: "Feb — Apr - active", state: "active", durationWeight: 3 },
  { label: "May - curtailed", state: "curtailed", durationWeight: 1 },
  { label: "Jun - active", state: "active", durationWeight: 1.4 },
] as const;

/** Proof & contract status rows — same 4 rows as the real dashboard. */
export const PROOF_ROWS = [
  ["Network", "Base Sepolia"],
  ["Contract code", "Present"],
  ["Allocation source", "LIVE"],
  ["Delivery evidence", "At maturity"],
] as const;

export const FOOTER_NOTE =
  "Accumulated BTC is delivered at maturity. Allocation, reserve and mining figures carry their own provenance; estimates and forward-looking outcomes are not guaranteed.";
