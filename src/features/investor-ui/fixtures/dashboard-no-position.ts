// src/features/investor-ui/fixtures/dashboard-no-position.ts
//
// Signed-in, KYC-approved investor with zero positions — the honest empty
// state the real portfolio contract already models (ghost/mock data banned).

import { fixtureBlock } from "./factories";
import { dashboardCompleteFixture } from "./dashboard-complete";
import type { DashboardViewModel } from "../types/dashboard";

export const dashboardNoPositionFixture: DashboardViewModel = {
  ...dashboardCompleteFixture,
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
  distributions: fixtureBlock({
    count: 0,
    totalDistributedUsdc: null,
    lastDistributionAt: null,
    recent: [],
  }),
  activity: fixtureBlock([]),
  alerts: fixtureBlock([
    {
      code: "no_position",
      severity: "info",
      message: "No active position yet — subscribe to the Hearst Mining Note to get started.",
    },
  ]),
};
