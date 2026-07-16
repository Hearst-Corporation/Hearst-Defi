// src/features/investor-ui/fixtures/profile-complete.ts
//
// Fully-populated Profile fixture — verified investor, share class A,
// security + preferences set, one subscription event on record.

import { fixtureBlock, FIXTURE_GENERATED_AT } from "./factories";
import type { ProfileViewModel } from "../types/profile";

export const profileCompleteFixture: ProfileViewModel = {
  generatedAt: FIXTURE_GENERATED_AT,
  identity: fixtureBlock({
    kycStatus: "approved",
    shareClass: "A",
    whitelisted: true,
    walletAddress: "0xAbCd000000000000000000000000000000EeFf",
    accredited: true,
  }),
  contact: fixtureBlock({
    displayName: "Jordan Ellis",
    email: "jordan.ellis@example.com",
    entityName: "Ellis Capital SPV LLC",
    country: "US",
  }),
  kyc: fixtureBlock({
    status: "verified",
    reason: null,
    submittedAt: "2026-01-10T00:00:00.000Z",
    reviewedAt: "2026-01-14T00:00:00.000Z",
  }),
  investorStatus: fixtureBlock({
    shareClass: "A",
    accredited: true,
    accreditationAttestedAt: "2026-01-14T00:00:00.000Z",
    whitelisted: true,
  }),
  security: fixtureBlock({
    walletAddress: "0xAbCd000000000000000000000000000000EeFf",
    twoFactorEnabled: true,
    sessions: [
      {
        id: "sess_fixture_1",
        createdAt: "2026-06-30T08:00:00.000Z",
        expiresAt: "2026-07-30T08:00:00.000Z",
        current: true,
      },
    ],
  }),
  preferences: fixtureBlock({
    emailNotifications: true,
    productUpdates: true,
    securityAlerts: true,
  }),
  documents: fixtureBlock([
    {
      type: "subscription_agreement",
      status: "approved",
      submittedAt: "2026-01-12T00:00:00.000Z",
    },
    {
      type: "kyc_id",
      status: "approved",
      submittedAt: "2026-01-10T00:00:00.000Z",
    },
  ]),
  subscriptionHistory: fixtureBlock({
    count: 1,
    totalDeployedUsdc: "250000.000000",
    firstSubscribedAt: "2026-01-15T00:00:00.000Z",
    events: [
      {
        type: "deposit",
        amountUsdc: "250000.000000",
        occurredAt: "2026-01-15T09:12:00.000Z",
        txHash: "0xdeadbeef00000000000000000000000000000000000000000000000000aa",
      },
    ],
  }),
  activity: fixtureBlock([
    {
      type: "deposit",
      amountUsdc: "250000.000000",
      occurredAt: "2026-01-15T09:12:00.000Z",
      txHash: "0xdeadbeef00000000000000000000000000000000000000000000000000aa",
    },
  ]),
};
