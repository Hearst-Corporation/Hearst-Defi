// src/features/investor-ui/fixtures/dashboard-cap-full.ts
//
// Vault at 100% utilization — subscription closes even for an eligible,
// KYC-approved investor. Exercises the "cap full" empty/blocked state.

import { fixtureBlock } from "./factories";
import { dashboardCompleteFixture } from "./dashboard-complete";
import type { DashboardViewModel } from "../types/dashboard";

export const dashboardCapFullFixture: DashboardViewModel = {
  ...dashboardCompleteFixture,
  capacity: fixtureBlock({
    tvlCap: "20000000.000000",
    totalAssets: "20000000.000000",
    availableCapacity: "0.000000",
    utilizationBps: 10000,
  }),
  subscription: fixtureBlock({
    subscriptionOpen: false,
    minimumDeposit: "250000.000000",
    whitelistRequired: true,
    userEligible: true,
  }),
  alerts: fixtureBlock([
    {
      code: "cap_full",
      severity: "notice",
      message: "The vault has reached its TVL cap — new subscriptions are paused.",
    },
  ]),
};
