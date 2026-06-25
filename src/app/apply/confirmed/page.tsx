import type { Metadata } from "next";
import Link from "next/link";

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
              you&rsquo;ll be signed in automatically and taken straight to your
              cockpit. Have a question in the meantime? Reach out to Investor
              Relations any time.
            </p>
          </div>
        </div>
      }
      sole={
        <OnboardingChamberSole
          irContact={irContact}
          actions={
            <div className="product-doc-stack--actions">
              <p className="body-sm ct-text-muted m-0 text-center text-pretty">
                Your activation link is on its way. Once you set your password
                you&apos;ll be signed in automatically — no need to come back here.
              </p>
              <p className="body-xs ct-text-faint m-0 text-center">
                Didn&apos;t receive the email?{" "}
                <Link href="/forgot-password" className="ct-link-accent">
                  Request a new activation link
                </Link>
                .
              </p>
            </div>
          }
          compliance={
            <>Institutional USDC yield. For qualified investors only. Cayman SPV structure.</>
          }
        />
      }
    />
  );
}
