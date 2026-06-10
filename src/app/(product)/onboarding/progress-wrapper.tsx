"use client";

/**
 * OnboardingProgressWrapper — client thin-wrapper that reads the `step`
 * searchParam to drive StepProgressBar. Isolated to a client component to
 * satisfy Next.js 16's rule that useSearchParams must be in a client component
 * wrapped in Suspense.
 */

import { useSearchParams } from "next/navigation";

import {
  StepProgressBar,
  type OnboardingStepId,
} from "@/components/onboarding/StepProgressBar";

const VALID_STEPS = new Set<OnboardingStepId>([
  "landing",
  "accreditation",
  "identity",
  "wallet",
]);

function isValidStep(s: string | null): s is OnboardingStepId {
  return s !== null && VALID_STEPS.has(s as OnboardingStepId);
}

export function OnboardingProgressWrapper() {
  const sp = useSearchParams();
  const raw = sp.get("step");
  const active: OnboardingStepId = isValidStep(raw) ? raw : "landing";

  return <StepProgressBar active={active} />;
}
