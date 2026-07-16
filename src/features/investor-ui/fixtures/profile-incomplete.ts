// src/features/investor-ui/fixtures/profile-incomplete.ts
//
// Signed-up investor mid-onboarding: KYC incomplete, no wallet linked yet,
// no subscription. Exercises the "finish setup" profile state.

import { fixtureBlock, fixtureUnresolved, FIXTURE_GENERATED_AT } from "./factories";
import type {
  ProfileInvestorStatusViewModel,
  ProfileSubscriptionHistoryViewModel,
  ProfileViewModel,
} from "../types/profile";

export const profileIncompleteFixture: ProfileViewModel = {
  generatedAt: FIXTURE_GENERATED_AT,
  identity: fixtureBlock({
    kycStatus: "pending",
    shareClass: null,
    whitelisted: false,
    walletAddress: null,
    accredited: false,
  }),
  contact: fixtureBlock({
    displayName: "Alex Rivera",
    email: "alex.rivera@example.com",
    entityName: null,
    country: "US",
  }),
  kyc: fixtureBlock({
    status: "incomplete",
    reason: "Missing proof of address",
    submittedAt: "2026-06-20T00:00:00.000Z",
    reviewedAt: null,
  }),
  investorStatus: fixtureUnresolved<ProfileInvestorStatusViewModel>("PARTIAL", {
    freshness: "accreditation not yet attested",
  }),
  security: fixtureBlock({
    walletAddress: null,
    twoFactorEnabled: null,
    sessions: [
      {
        id: "sess_fixture_incomplete_1",
        createdAt: "2026-07-01T08:00:00.000Z",
        expiresAt: "2026-07-08T08:00:00.000Z",
        current: true,
      },
    ],
  }),
  preferences: fixtureBlock({
    emailNotifications: true,
    productUpdates: false,
    securityAlerts: true,
  }),
  documents: fixtureBlock([
    {
      type: "kyc_id",
      status: "pending",
      submittedAt: "2026-06-20T00:00:00.000Z",
    },
  ]),
  subscriptionHistory: fixtureUnresolved<ProfileSubscriptionHistoryViewModel>("UNAVAILABLE", {
    freshness: "no subscription yet",
  }),
  activity: fixtureBlock([]),
};
