// src/features/investor-ui/types/profile.ts
//
// Profile-screen view model. Reuses InvestorIdentityViewModel (identity/KYC
// facts are the same underlying block the Dashboard shows) plus profile-only
// contact/document/security/preferences/subscription-history/activity fields.

import type { ResolvedViewModel } from "./common";
import type { ActivityItemViewModel, InvestorIdentityViewModel } from "./dashboard";

export interface ProfileContactViewModel {
  readonly displayName: string | null;
  readonly email: string | null;
  readonly entityName: string | null; // SPV / legal entity on file, if any
  readonly country: string | null;
}

export interface ProfileDocumentViewModel {
  readonly type: string; // e.g. "subscription_agreement" | "kyc_id"
  readonly status: string; // pending | approved | rejected
  readonly submittedAt: string | null; // ISO
}

/** Detailed KYC/verification state — superset of the coarse `identity.kycStatus`
 *  string, carrying the reviewer-facing reason/next-step. */
export interface ProfileKycViewModel {
  readonly status: "verified" | "pending" | "incomplete" | "restricted";
  readonly reason: string | null; // e.g. rejection reason, or missing-doc hint
  readonly submittedAt: string | null; // ISO
  readonly reviewedAt: string | null; // ISO
}

/** Investor standing facts distinct from raw KYC — share class, accreditation,
 *  and product whitelist gating. */
export interface ProfileInvestorStatusViewModel {
  readonly shareClass: "A" | "B" | null;
  readonly accredited: boolean;
  readonly accreditationAttestedAt: string | null; // ISO
  readonly whitelisted: boolean | null;
}

export interface ProfileSessionViewModel {
  readonly id: string;
  readonly createdAt: string; // ISO
  readonly expiresAt: string; // ISO
  readonly current: boolean;
}

/** Security posture: auth method + 2FA + wallet link + active sessions.
 *  `twoFactorEnabled` is `null` (not `false`) when the platform doesn't yet
 *  persist a 2FA flag — never fabricate an "off" for a feature not built. */
export interface ProfileSecurityViewModel {
  readonly walletAddress: string | null;
  readonly twoFactorEnabled: boolean | null;
  readonly sessions: readonly ProfileSessionViewModel[];
}

export interface ProfilePreferencesViewModel {
  readonly emailNotifications: boolean;
  readonly productUpdates: boolean;
  readonly securityAlerts: boolean;
}

export interface ProfileSubscriptionEventViewModel {
  readonly type: string; // deposit | claim | withdraw | distribution
  readonly amountUsdc: string;
  readonly occurredAt: string; // ISO
  readonly txHash: string | null;
}

export interface ProfileSubscriptionHistoryViewModel {
  readonly count: number;
  readonly totalDeployedUsdc: string | null;
  readonly firstSubscribedAt: string | null; // ISO
  readonly events: readonly ProfileSubscriptionEventViewModel[];
}

export interface ProfileViewModel {
  readonly generatedAt: string; // ISO
  readonly identity: ResolvedViewModel<InvestorIdentityViewModel>;
  readonly contact: ResolvedViewModel<ProfileContactViewModel>;
  readonly kyc: ResolvedViewModel<ProfileKycViewModel>;
  readonly investorStatus: ResolvedViewModel<ProfileInvestorStatusViewModel>;
  readonly security: ResolvedViewModel<ProfileSecurityViewModel>;
  readonly preferences: ResolvedViewModel<ProfilePreferencesViewModel>;
  readonly documents: ResolvedViewModel<readonly ProfileDocumentViewModel[]>;
  readonly subscriptionHistory: ResolvedViewModel<ProfileSubscriptionHistoryViewModel>;
  readonly activity: ResolvedViewModel<readonly ActivityItemViewModel[]>;
}
