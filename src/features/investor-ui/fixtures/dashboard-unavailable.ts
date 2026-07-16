// src/features/investor-ui/fixtures/dashboard-unavailable.ts
//
// Every block UNAVAILABLE — GPU1 answered but nothing could be resolved
// (e.g. session established but the backend's own dependencies are down).
// Distinct from `dashboard-not-configured` (contract not deployed, expected)
// and from a data-source ERROR (the call itself failed).

import { fixtureUnresolved } from "./factories";
import type { DashboardViewModel } from "../types/dashboard";
import type {
  ActivityItemViewModel,
  AllocationBreakdownViewModel,
  AlertViewModel,
  DistributionViewModel,
  InvestorIdentityViewModel,
  InvestorPositionViewModel,
  ProofSummaryViewModel,
  SubscriptionViewModel,
  VaultCapacityViewModel,
} from "../types/dashboard";

export const dashboardUnavailableFixture: DashboardViewModel = {
  runtime: {
    mode: "not_configured",
    chainId: null,
    contractAddress: null,
    codePresent: false,
    indexerLagBlocks: null,
    generatedAt: "2026-07-01T12:00:00.000Z",
  },
  identity: fixtureUnresolved<InvestorIdentityViewModel>("UNAVAILABLE"),
  position: fixtureUnresolved<InvestorPositionViewModel>("UNAVAILABLE"),
  allocation: fixtureUnresolved<AllocationBreakdownViewModel>("UNAVAILABLE"),
  capacity: fixtureUnresolved<VaultCapacityViewModel>("UNAVAILABLE"),
  subscription: fixtureUnresolved<SubscriptionViewModel>("UNAVAILABLE"),
  distributions: fixtureUnresolved<DistributionViewModel>("UNAVAILABLE"),
  activity: fixtureUnresolved<readonly ActivityItemViewModel[]>("UNAVAILABLE"),
  alerts: fixtureUnresolved<readonly AlertViewModel[]>("UNAVAILABLE"),
  proofs: fixtureUnresolved<ProofSummaryViewModel>("UNAVAILABLE"),
};
