import type { Metadata } from "next";

import {
  OnboardingChamber,
  OnboardingChamberSole,
} from "@/components/onboarding/onboarding-chamber";

import { ApplyForm } from "./apply-form";

export const metadata: Metadata = {
  title: "Apply — Hearst Connect",
  description:
    "Qualify for access to Hearst Connect — institutional USDC yield, mining-backed structured product.",
  robots: { index: false, follow: false },
};

export default function ApplyPage() {
  return (
    <div className="product-doc flex min-h-full flex-1 justify-center">
      <section className="ml-auto flex w-full max-w-232 flex-1 flex-col pt-[clamp(2rem,8vh,4rem)] pb-(--ct-space-10)">
        <OnboardingChamber
          crown={
            <div className="product-doc-stack onboarding-shell__stepper">
              <div className="product-doc-stack--tight">
                <span className="eyebrow ct-text-accent">Hearst Connect</span>
                <div className="product-doc-stack--compact">
                  <h1 className="h1 m-0 max-w-3xl">Qualification for institutional access</h1>
                  <p className="body-md ct-text-muted m-0 max-w-2xl">
                    Three steps to assess fit for Hearst Connect&apos;s institutional
                    USDC yield program. No commitment required.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 body-xs ct-text-muted">
                <span className="rounded-full border border-(--ct-border-soft) px-3 py-1">
                  3 steps
                </span>
                <span className="rounded-full border border-(--ct-border-soft) px-3 py-1">
                  About 2 minutes
                </span>
                <span className="rounded-full border border-(--ct-border-soft) px-3 py-1">
                  For qualified investors only
                </span>
              </div>
            </div>
          }
          body={<ApplyForm />}
          sole={
            <OnboardingChamberSole
              irContact={null}
              compliance={
                <>
                  Not a guarantee of return. Past performance is not indicative of
                  future results. For qualified investors only. Cayman SPV structure.
                </>
              }
            />
          }
        />
      </section>
    </div>
  );
}
