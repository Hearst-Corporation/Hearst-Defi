// src/features/investor-ui/fixtures/mining-complete.ts
//
// Fully-populated Mining fixture — active fleet, mid-term (month 9 of 24),
// electricity payments current. Use as the default "happy path" dev fixture.
//
// (Note: A4's Mining page stubbed this file first with an identical shape —
// this is A5's canonical drop, same convention, keeps A4's field values so
// nothing visually shifts under them.)

import { fixtureBlock, FIXTURE_GENERATED_AT } from "./factories";
import type { MiningViewModel } from "../types/mining";

export const miningCompleteFixture: MiningViewModel = {
  generatedAt: FIXTURE_GENERATED_AT,
  mining: fixtureBlock({
    reportedHashrateTh: "412.50",
    totalBtcEarnedSats: "18420500",
    lastReportTime: "2026-07-01T06:00:00.000Z",
    currentMonth: 9,
    productDurationMonths: 24,
    fleetActive: true,
    curtailed: false,
    halvingMonth: null,
    vendingCurveBps: 250,
  }),
  electricity: fixtureBlock({
    monthlyCost: "14820.000000",
    payee: "Grid Operator Co.",
    totalPaid: "133380.000000",
    lastPayment: "2026-06-01T00:00:00.000Z",
    nextEligiblePayment: "2026-07-01T00:00:00.000Z",
    canPay: true,
  }),
};
