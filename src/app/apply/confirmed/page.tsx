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
    <OnboardingChamber
      testId="apply-confirmed"
      crown={
        <div className="product-doc-stack onboarding-shell__stepper">
          <span className="eyebrow ct-text-accent">Hearst Connect</span>
          <div className="product-doc-stack--compact">
            <h1 className="h1 m-0">Application received</h1>
            <p className="body-md ct-text-muted m-0 text-pretty ct-prose-lg">
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
            <p className="body-sm ct-text-muted m-0 text-pretty">
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
  );
}
