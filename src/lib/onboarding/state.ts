import "server-only";

import type { Investor } from "@prisma/client";

import { isSumsubConfigured } from "@/lib/onboarding/config";

export type OnboardingStepId = "accreditation" | "identity" | "wallet";

export interface OnboardingChecklistItem {
  id: "accreditation" | "kyc" | "wallet";
  label: string;
  done: boolean;
  optional?: boolean;
}

export interface OnboardingState {
  accreditationAttested: boolean;
  kycApproved: boolean;
  kycPending: boolean;
  walletBound: boolean;
  kycVendorConfigured: boolean;
  checklist: OnboardingChecklistItem[];
}

export function resolveOnboardingState(
  investor: Investor | null,
  hasKycInquiry: boolean,
): OnboardingState {
  const accreditationAttested = investor?.accreditationAttestedAt != null;
  const kycApproved = investor?.kycStatus === "approved";
  const kycPending =
    investor?.kycStatus === "pending" && hasKycInquiry;
  const walletBound = (investor?.walletAddress ?? "").length > 0;
  const kycVendorConfigured = isSumsubConfigured();

  const kycDone = kycVendorConfigured
    ? kycApproved
    : accreditationAttested && process.env.NODE_ENV !== "production";

  const checklist: OnboardingChecklistItem[] = [
    {
      id: "accreditation",
      label: "Accredited investor attestation",
      done: accreditationAttested,
    },
    {
      id: "kyc",
      label: kycVendorConfigured
        ? "Government ID & liveness verification"
        : "Identity verification (not configured)",
      done: kycDone,
    },
    {
      id: "wallet",
      label: "Distribution wallet",
      done: walletBound,
      optional: true,
    },
  ];

  return {
    accreditationAttested,
    kycApproved,
    kycPending,
    walletBound,
    kycVendorConfigured,
    checklist,
  };
}

export function onboardingStepFromPathname(pathname: string): OnboardingStepId {
  if (pathname.startsWith("/onboarding/identity")) return "identity";
  if (pathname.startsWith("/onboarding/wallet")) return "wallet";
  return "accreditation";
}
