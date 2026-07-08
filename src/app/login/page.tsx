// `/login` — the sign-in screen (email + password, database auth).
//
// This is the canonical login route the edge proxy redirects to
// (`/login?from=<path>`). The email/password form lives in a client child
// (`LoginForm`) that reads `?from=` via `useSearchParams`, so it is wrapped in
// a Suspense boundary as Next.js requires.
//
// If a valid server-verified session already exists, honor `?from=` (deep
// link) the same way a fresh sign-in would, otherwise land on the platform
// default — an already authenticated visitor should never see the sign-in
// form again just by navigating back to `/login`.

import { Suspense } from "react";

import { redirect } from "next/navigation";

import { LoginSplit } from "@/components/auth/login-split";
import { getSession } from "@/lib/auth/session";
import { resolvePostLoginRedirect } from "@/lib/onboarding/post-login-redirect";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in — Hearst Connect",
  description: "Sign in with your email and password to access your portfolio.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await getSession();
  if (session) {
    const { from } = await searchParams;
    redirect(await resolvePostLoginRedirect(session.userId, from));
  }

  return (
    <Suspense fallback={null}>
      <LoginSplit />
    </Suspense>
  );
}
