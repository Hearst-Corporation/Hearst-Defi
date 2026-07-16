// src/features/investor-ui/fixtures/dashboard-not-configured.ts
//
// Contract-owned blocks NOT_CONFIGURED (v2.1 not deployed yet); DB-backed
// blocks (identity/position/subscription) remain FIXTURE-populated because
// they don't depend on the contract. This is the closest fixture to "today,
// before v2.1 deploy" for an investor who already subscribed.

import { fixtureBlock, fixtureUnresolved } from "./factories";
import { dashboardCompleteFixture } from "./dashboard-complete";
import type { DashboardViewModel } from "../types/dashboard";
import type { AllocationBreakdownViewModel, VaultCapacityViewModel } from "../types/dashboard";

export const dashboardNotConfiguredFixture: DashboardViewModel = {
  ...dashboardCompleteFixture,
  runtime: {
    mode: "not_configured",
    chainId: null,
    contractAddress: null,
    codePresent: false,
    indexerLagBlocks: null,
    generatedAt: dashboardCompleteFixture.runtime.generatedAt,
  },
  allocation: fixtureUnresolved<AllocationBreakdownViewModel>("NOT_CONFIGURED", {
    freshness: "PermissionedDynaVault v2.1 not deployed",
  }),
  capacity: fixtureUnresolved<VaultCapacityViewModel>("NOT_CONFIGURED", {
    freshness: "PermissionedDynaVault v2.1 not deployed",
  }),
  proofs: fixtureBlock(dashboardCompleteFixture.proofs.value ?? {
    totalProofs: 0,
    latestProofAt: null,
    types: [],
  }),
};
