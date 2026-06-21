"use client";

/**
 * Thin client wrapper so OnboardingRequirementsList (which lives in the
 * "use client" onboarding-chamber module) can be consumed by the Server
 * Component OnboardingShell without turning the whole shell into a client
 * component. Props are plain-serialisable (OnboardingChecklistItem[]).
 */

import { OnboardingRequirementsList } from "@/components/onboarding/onboarding-chamber";
import type { OnboardingChecklistItem } from "@/lib/onboarding/state";

export function OnboardingChecklistRail({
  items,
}: {
  items: OnboardingChecklistItem[];
}) {
  return <OnboardingRequirementsList items={items} />;
}
