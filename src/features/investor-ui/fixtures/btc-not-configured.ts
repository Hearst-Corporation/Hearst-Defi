// src/features/investor-ui/fixtures/btc-not-configured.ts

import { fixtureUnresolved, FIXTURE_GENERATED_AT } from "./factories";
import type { BitcoinReserveViewModel, BtcViewModel, PerformanceViewModel } from "../types/btc";

export const btcNotConfiguredFixture: BtcViewModel = {
  generatedAt: FIXTURE_GENERATED_AT,
  reserve: fixtureUnresolved<BitcoinReserveViewModel>("NOT_CONFIGURED", {
    freshness: "PermissionedDynaVault v2.1 not deployed",
  }),
  performance: fixtureUnresolved<PerformanceViewModel>("NOT_CONFIGURED", {
    freshness: "PermissionedDynaVault v2.1 not deployed",
  }),
};
