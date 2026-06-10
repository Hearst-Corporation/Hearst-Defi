/**
 * Onboarding layout — wraps all /onboarding/* pages with the 7-step progress bar.
 *
 * The active step is passed via the `step` searchParam so each page can
 * declare its own step without a parallel route or context.
 * Server Component — no interactivity.
 */

import { Suspense } from "react";
import type { ReactNode } from "react";

import { OnboardingProgressWrapper } from "./progress-wrapper";

export const metadata = {
  title: "Onboarding — Hearst Yield Vault",
};

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-8 px-6 py-10 max-w-2xl mx-auto w-full">
      {/* Progress bar — reads `step` searchParam; wrapped in Suspense per Next.js requirements for useSearchParams */}
      <Suspense fallback={<div className="h-10 w-full" />}>
        <OnboardingProgressWrapper />
      </Suspense>

      {/* Page content */}
      {children}
    </div>
  );
}
