// src/features/investor-ui/fixtures/mining-stale.ts
//
// Stale fixture — fleet reporting, but last report is old and the electricity
// payment window has lapsed without a fresh report. STALE status communicates
// "we have a value, do not trust its freshness".

import { FIXTURE_GENERATED_AT } from "./factories";
import { resolved } from "../types/common";
import type { MiningViewModel } from "../types/mining";

// `fixtureBlock` always forces `status: "FIXTURE"` — this fixture needs to
// communicate the STALE business status on top of fixture-sourced data, so
// it calls `resolved()` directly (same helper `fixtureBlock` wraps) with an
// explicit `status: "STALE"` + `provenance: "fixture"` so it never reads as
// live data.
export const miningStaleFixture: MiningViewModel = {
  generatedAt: FIXTURE_GENERATED_AT,
  mining: resolved(
    "STALE",
    {
      reportedHashrateTh: "398.10",
      totalBtcEarnedSats: "17960200",
      lastReportTime: "2026-06-02T06:00:00.000Z",
      currentMonth: 8,
      productDurationMonths: 24,
      fleetActive: true,
      curtailed: false,
      halvingMonth: null,
      vendingCurveBps: 250,
    },
    {
      provenance: "fixture",
      freshness: "last reported 29 days ago — awaiting fresh report",
      generatedAt: FIXTURE_GENERATED_AT,
      error: null,
    },
  ),
  electricity: resolved(
    "STALE",
    {
      monthlyCost: "14200.000000",
      payee: "Grid Operator Co.",
      totalPaid: "113600.000000",
      lastPayment: "2026-05-01T00:00:00.000Z",
      nextEligiblePayment: "2026-06-01T00:00:00.000Z",
      canPay: false,
    },
    {
      provenance: "fixture",
      freshness: "last payment 2 cycles ago — awaiting keeper run",
      generatedAt: FIXTURE_GENERATED_AT,
      error: null,
    },
  ),
};
