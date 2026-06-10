// `/` — canonical entry point: delegates to the same LoginSplit as `/login`.
// The proxy redirects protected routes to `/login?from=<path>`; landing on `/`
// directly shows the same split-screen so there is exactly one login design.

import { Suspense } from "react";

import { LoginSplit } from "@/components/auth/login-split";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Hearst Connect — Institutional Yield Backed by Bitcoin Mining",
  description:
    "Hearst Yield Vault: mining-backed structured yield, monthly USDC distributions, target APY 8–15%. Accredited investors only.",
};

export default function LandingPage() {
  return (
    <Suspense fallback={null}>
      <LoginSplit />
    </Suspense>
  );
}
