import type { Metadata } from "next";

import {
  OnboardingChamber,
  OnboardingChamberSole,
} from "@/components/onboarding/onboarding-chamber";
import { getIrContact } from "@/lib/ir-contact";

export const metadata: Metadata = {
  title: "Application received — Hearst Connect",
  robots: { index: false, follow: false },
};

export default function ConfirmedPage() {
  const irContact = getIrContact();

  return (
    <OnboardingChamber
      testId="apply-confirmed"
      crown={
        <div className="product-doc-stack onboarding-shell__stepper text-left">
          <div className="product-doc-stack--tight">
            <p className="eyebrow ct-text-muted m-0">Hearst Connect · Application received</p>
            <div className="product-doc-stack--compact">
              <h1 className="h1 m-0 text-pretty">Application received</h1>
              <p className="body-md ct-text-muted m-0 text-pretty ct-prose-lg">
                Thank you. We&apos;ve emailed you an activation link to set your
                password and access your investor cockpit — check your inbox now.
              </p>
            </div>
          </div>
        </div>
      }
      body={
        <div className="product-doc-stack--relaxed">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-(--ct-accent) ct-status-success-bg ct-text-accent body-sm font-semibold">
            ✓
          </div>
          <div className="product-doc-stack--tight">
            <h2 className="h2 m-0">What to expect</h2>
            <p className="body-sm ct-text-muted m-0 text-pretty">
              Check your inbox now for the activation link to set your password —
              it opens your cockpit once you sign in. Have a question in the
              meantime? Reach out to Investor Relations any time.
            </p>
          </div>
        </div>
      }
      sole={
        <OnboardingChamberSole
          irContact={irContact}
          compliance={
            <>Institutional USDC yield. For qualified investors only. Cayman SPV structure.</>
          }
        />
      }
    />
  );
}
