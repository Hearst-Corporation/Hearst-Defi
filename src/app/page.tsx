// `/` — canonical entry point: delegates to the same LoginSplit as `/login`.
// The proxy redirects protected routes to `/login?from=<path>`; landing on `/`
// directly shows the same split-screen so there is exactly one login design.
//
// If a valid server-verified session already exists, skip the login screen
// entirely and land the user where a fresh sign-in would — an already
// authenticated visitor hitting `/` should never be shown the sign-in form
// again.

import { redirect } from "next/navigation";
import { Suspense } from "react";

import { LoginSplit } from "@/components/auth/login-split";
import { getSession } from "@/lib/auth/session";
import { resolvePostLoginRedirect } from "@/lib/onboarding/post-login-redirect";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Hearst Connect — Institutional Yield Backed by Bitcoin Mining",
  description:
    "Hearst Yield Vault: mining-backed structured yield, monthly USDC distributions, target APY 8–15%. Accredited investors only.",
};

export default async function LandingPage() {
  const session = await getSession();
  if (session) {
    redirect(await resolvePostLoginRedirect(session.userId));
  }

  return (
    <Suspense fallback={null}>
      <LoginSplit />
    </Suspense>
  );
}
