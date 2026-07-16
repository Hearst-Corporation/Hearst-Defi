// src/features/investor-ui/fixtures/btc-complete.ts

import { fixtureBlock, FIXTURE_GENERATED_AT } from "./factories";
import type { BtcViewModel } from "../types/btc";

export const btcCompleteFixture: BtcViewModel = {
  generatedAt: FIXTURE_GENERATED_AT,
  reserve: fixtureBlock({
    reserveUsdc: "2779000.000000",
    reserveBps: 3300,
    electricityCoveredMonths: 14,
    reserveBtcSats: "612000000",
    reserveBtcUsd: "36720000.000000",
  }),
  performance: fixtureBlock({
    navPerShare: "1.0736",
    totalReturnBps: 736,
    takeProfitProgressBps: 4120,
    estimatedRangeLowBps: 940,
    estimatedRangeHighBps: 1280,
  }),
};
