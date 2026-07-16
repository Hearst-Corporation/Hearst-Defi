// src/features/investor-ui/fixtures/dashboard-partial.ts
//
// Mixed-status Dashboard fixture: DB-backed blocks are FIXTURE/populated, but
// contract-owned blocks (capacity/allocation actuals) are NOT_CONFIGURED
// because v2.1 is not deployed yet — the realistic "today" state.

import { fixtureBlock, fixtureUnresolved } from "./factories";
import { dashboardCompleteFixture } from "./dashboard-complete";
import type { DashboardViewModel } from "../types/dashboard";
import type { AllocationBreakdownViewModel, VaultCapacityViewModel } from "../types/dashboard";

export const dashboardPartialFixture: DashboardViewModel = {
  ...dashboardCompleteFixture,
  runtime: {
    ...dashboardCompleteFixture.runtime,
    mode: "not_configured",
    chainId: null,
    contractAddress: null,
    codePresent: false,
    indexerLagBlocks: null,
  },
  allocation: fixtureUnresolved<AllocationBreakdownViewModel>("NOT_CONFIGURED", {
    freshness: "on-chain allocation not yet indexed",
  }),
  capacity: fixtureUnresolved<VaultCapacityViewModel>("NOT_CONFIGURED", {
    freshness: "vault capacity not yet indexed",
  }),
  activity: fixtureBlock(dashboardCompleteFixture.activity.value ?? [], {
    freshness: "showing DB-known activity only — on-chain events not indexed",
  }),
};
