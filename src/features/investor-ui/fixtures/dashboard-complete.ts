// src/features/investor-ui/fixtures/dashboard-complete.ts
//
// Fully-populated Dashboard fixture — every block LIVE-shaped-but-FIXTURE, an
// investor with an active position, mid-term. Use as the default "happy path"
// dev fixture.

import { fixtureBlock, FIXTURE_GENERATED_AT } from "./factories";
import type { DashboardViewModel } from "../types/dashboard";

export const dashboardCompleteFixture: DashboardViewModel = {
  runtime: {
    mode: "v2-testnet",
    chainId: 84532,
    contractAddress: "0x1234000000000000000000000000000000abcd",
    codePresent: true,
    indexerLagBlocks: 3,
    generatedAt: FIXTURE_GENERATED_AT,
  },
  identity: fixtureBlock({
    kycStatus: "approved",
    shareClass: "A",
    whitelisted: true,
    walletAddress: "0xAbCd000000000000000000000000000000EeFf",
    accredited: true,
  }),
  position: fixtureBlock({
    principal: "250000.000000",
    accrued: "18420.500000",
    value: "268420.500000",
    deposits: "250000.000000",
    withdrawals: "0.000000",
    shares: null,
    positionsCount: 1,
    subscribedAt: "2026-01-15T00:00:00.000Z",
    status: "active",
  }),
  allocation: fixtureBlock({
    pockets: [
      { pocket: "B1", label: "Mining Power", targetBps: 4000, actualBps: 3960 },
      { pocket: "B2", label: "BTC Pouch", targetBps: 2700, actualBps: 2740 },
      { pocket: "B3", label: "Reserve", targetBps: 3300, actualBps: 3300 },
    ],
    targetTotalBps: 10000,
  }),
  capacity: fixtureBlock({
    tvlCap: "20000000.000000",
    totalAssets: "8420000.000000",
    availableCapacity: "11580000.000000",
    utilizationBps: 4210,
  }),
  subscription: fixtureBlock({
    subscriptionOpen: true,
    minimumDeposit: "250000.000000",
    whitelistRequired: true,
    userEligible: true,
  }),
  distributions: fixtureBlock({
    count: 0,
    totalDistributedUsdc: null,
    lastDistributionAt: null,
    recent: [],
  }),
  activity: fixtureBlock([
    {
      type: "deposit",
      amountUsdc: "250000.000000",
      occurredAt: "2026-01-15T09:12:00.000Z",
      txHash: "0xdeadbeef00000000000000000000000000000000000000000000000000aa",
    },
  ]),
  alerts: fixtureBlock([
    {
      code: "lockup_active",
      severity: "info",
      message: "Position is within the 60-day soft lock-up window.",
    },
  ]),
  proofs: fixtureBlock({
    totalProofs: 6,
    latestProofAt: "2026-06-30T00:00:00.000Z",
    types: ["por-attestation", "custody-statement"],
  }),
};
