import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getSession } from "@/lib/auth/session";
import { resolvePostLoginRedirect } from "@/lib/onboarding/post-login-redirect";
import { LoginPage } from "@/views/auth/login-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Hearst Connect — Institutional Bitcoin Accumulation, Backed by Mining",
  description:
    "Hearst Mining Note: real Bitcoin mining accumulates BTC over a 24-month term, delivered at maturity. No periodic distribution, no fixed rate — estimated outcomes are disclosed as a range, not guaranteed. Accredited investors only.",
};

export default async function LandingPage() {
  const session = await getSession();
  if (session) {
    redirect(await resolvePostLoginRedirect(session.userId));
  }

  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}
