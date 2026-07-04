import Link from "next/link";

import {
  OnboardingChamber,
  OnboardingChamberSole,
} from "@/components/onboarding/onboarding-chamber";
import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = {
  title: "Reset password — Hearst Connect",
};

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;

  return (
    <OnboardingChamber
      testId="reset-password"
      crown={
        <div className="product-doc-stack--compact text-left items-start">
          <h1
            className="m-0 text-pretty"
            style={{
              color: "var(--ct-accent)",
              fontSize: "var(--ct-text-5xl)",
              fontWeight: "var(--ct-font-normal)",
              letterSpacing: "var(--ct-tracking-tighter)",
              lineHeight: "var(--ct-leading-tight)",
            }}
          >
            Set a new password
          </h1>
          <p className="body-sm ct-text-muted m-0">
            {token
              ? "Choose a password of at least 8 characters."
              : "This reset link is invalid or has expired."}
          </p>
        </div>
      }
      body={
        token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="product-doc-stack--relaxed">
            <p className="body-sm ct-text-primary m-0">
              Request a fresh link to continue resetting your password.
            </p>
            <Button asChild variant="primary" size="lg" className="w-full">
              <Link href="/forgot-password">Request a new link</Link>
            </Button>
          </div>
        )
      }
      sole={
        <OnboardingChamberSole
          irContact={null}
          compliance={
            <>
              For your security, reset links expire after a short window and can
              only be used once.
            </>
          }
          actions={
            <p className="body-xs ct-text-muted text-center m-0">
              <Link href="/login" className="ct-link-accent">
                Back to sign in
              </Link>
            </p>
          }
        />
      }
    />
  );
}
