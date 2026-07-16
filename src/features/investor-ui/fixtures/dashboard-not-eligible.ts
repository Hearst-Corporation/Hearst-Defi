// src/features/investor-ui/fixtures/dashboard-not-eligible.ts
//
// Signed-in investor who is NOT yet eligible to subscribe (KYC pending, not
// whitelisted). Exercises the gated-onboarding state.

import { fixtureBlock } from "./factories";
import { dashboardCompleteFixture } from "./dashboard-complete";
import type { DashboardViewModel } from "../types/dashboard";

export const dashboardNotEligibleFixture: DashboardViewModel = {
  ...dashboardCompleteFixture,
  identity: fixtureBlock({
    kycStatus: "pending",
    shareClass: null,
    whitelisted: false,
    walletAddress: null,
    accredited: false,
  }),
  position: fixtureBlock({
    principal: null,
    accrued: null,
    value: null,
    deposits: null,
    withdrawals: null,
    shares: null,
    positionsCount: 0,
    subscribedAt: null,
    status: null,
  }),
  subscription: fixtureBlock({
    subscriptionOpen: true,
    minimumDeposit: "250000.000000",
    whitelistRequired: true,
    userEligible: false,
  }),
  activity: fixtureBlock([]),
  distributions: fixtureBlock({
    count: 0,
    totalDistributedUsdc: null,
    lastDistributionAt: null,
    recent: [],
  }),
  alerts: fixtureBlock([
    {
      code: "kyc_pending",
      severity: "warning",
      message: "Complete KYC review to become eligible to subscribe.",
    },
  ]),
};
