/**
 * Onboarding path definitions — pure types, safe to import from both server and
 * client components.
 *
 * Three divergent LP paths:
 *   individual  — private investor KYC → accreditation → bank wire
 *   corporate   — entity docs → UBO → KYC officer → bank wire
 *   fund        — fund formation → AML → sub-advisor → master account
 */

export const ONBOARDING_PATHS = ["individual", "corporate", "fund"] as const;
export type OnboardingPath = (typeof ONBOARDING_PATHS)[number];

export interface OnboardingStep {
  id: string;
  label: string;
  /** Short description surfaced under the step label in the stepper */
  description: string;
}

export const STEPS_BY_PATH: Record<OnboardingPath, readonly OnboardingStep[]> =
  {
    individual: [
      {
        id: "kyc",
        label: "Identity check",
        description: "Verify your identity with a government-issued ID",
      },
      {
        id: "accreditation",
        label: "Eligibility attestation",
        description: "Confirm accredited investor eligibility",
      },
      {
        id: "bank-wire",
        label: "Payout instructions",
        description: "Provide bank wire details for monthly USDC payouts",
      },
    ],
    corporate: [
      {
        id: "entity-docs",
        label: "Entity documents",
        description: "Upload incorporation and operating documents",
      },
      {
        id: "ubo",
        label: "Beneficial owners",
        description: "Declare ultimate beneficial owners at 10% or more",
      },
      {
        id: "kyc-officer",
        label: "Officer identity check",
        description: "Verify the authorized compliance officer",
      },
      {
        id: "bank-wire",
        label: "Payout instructions",
        description: "Provide bank wire details for monthly USDC payouts",
      },
    ],
    fund: [
      {
        id: "fund-formation",
        label: "Fund formation docs",
        description: "LPA, PPM, audited financial statements",
      },
      {
        id: "aml",
        label: "AML documentation",
        description: "Provide AML officer designation and policies",
      },
      {
        id: "sub-advisor",
        label: "Sub-advisor authority",
        description: "Confirm delegated investment authority",
      },
      {
        id: "master-account",
        label: "Master account setup",
        description: "Configure omnibus account and allocation keys",
      },
    ],
  };

export const PATH_META: Record<
  OnboardingPath,
  { title: string; subtitle: string; icon: string }
> = {
  individual: {
    title: "Individual Investor",
    subtitle: "For accredited individuals and family offices",
    icon: "person",
  },
  corporate: {
    title: "Corporate Entity",
    subtitle: "For corporations, LLCs, and partnerships",
    icon: "building",
  },
  fund: {
    title: "Fund of Funds",
    subtitle: "For institutional funds with sub-advisor structures",
    icon: "chart",
  },
};

/** Narrow an unknown string to a valid OnboardingPath (returns null if invalid) */
export function parseOnboardingPath(raw: string): OnboardingPath | null {
  if ((ONBOARDING_PATHS as readonly string[]).includes(raw)) {
    return raw as OnboardingPath;
  }
  return null;
}
