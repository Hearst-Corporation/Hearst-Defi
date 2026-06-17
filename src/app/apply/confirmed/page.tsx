import type { Metadata } from "next";

import {
  OnboardingChamber,
  OnboardingChamberSole,
} from "@/components/onboarding/onboarding-chamber";

export const metadata: Metadata = {
  title: "Application received — Hearst Connect",
  robots: { index: false, follow: false },
};

export default function ConfirmedPage() {
  return (
    <div className="product-doc flex min-h-full flex-1 justify-center">
      <section className="ml-auto flex w-full max-w-216 flex-1 flex-col pt-[clamp(2rem,8vh,4rem)] pb-(--ct-space-10)">
        <OnboardingChamber
          crown={
            <div className="product-doc-stack onboarding-shell__stepper">
              <span className="eyebrow ct-text-accent">Hearst Connect</span>
              <div className="product-doc-stack--compact">
                <h1 className="h1 m-0">Application received</h1>
                <p className="body-md ct-text-muted m-0 max-w-152">
                  Thank you. Our team will review your profile and send a login link to
                  access your investor cockpit within 1-2 business days.
                </p>
              </div>
            </div>
          }
          body={
            <div className="product-doc-stack--relaxed">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-(--ct-accent) ct-status-success-bg ct-text-accent body-sm font-semibold">
                ✓
              </div>
              <div className="product-doc-stack--tight">
                <h2 className="h2 m-0">Next steps</h2>
                <p className="body-sm ct-text-muted m-0">
                  We will confirm fit, complete internal review, and follow up directly
                  if we need anything else before provisioning access.
                </p>
              </div>
            </div>
          }
          sole={
            <OnboardingChamberSole
              irContact={null}
              compliance={
                <>Institutional USDC yield. For qualified investors only. Cayman SPV structure.</>
              }
            />
          }
        />
      </section>
    </div>
  );
}
