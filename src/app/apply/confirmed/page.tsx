import type { Metadata } from "next";
import Link from "next/link";

import {
  OnboardingChamber,
  OnboardingChamberSole,
} from "@/components/onboarding/onboarding-chamber";
import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
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
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex flex-col gap-2">
            <h1 className="h1 text-pretty" style={{ color: "var(--ct-accent)" }}>
              Application received
            </h1>
            <p className="body-sm text-pretty">
              Thank you. We&apos;ve emailed you an activation link to set your
              password.
            </p>
          </div>
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--ct-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] ct-text-accent">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
              className="shrink-0"
            >
              <path
                d="M5 13l4 4L19 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      }
      body={null}
      sole={
        <OnboardingChamberSole
          irContact={irContact}
          actions={
            <div className="flex flex-col items-center gap-3">
              <Button asChild variant="primary" size="md">
                <Link href="/login">Go to login →</Link>
              </Button>
              <p className="body-xs m-0 text-center text-pretty">
                Didn&apos;t receive the email?{" "}
                <Link href="/forgot-password" className="ct-link-accent">
                  Request a new activation link
                </Link>
                .
              </p>
            </div>
          }
        />
      }
    />
  );
}
