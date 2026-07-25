import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getSession } from "@/lib/auth/session";
import { resolvePostLoginRedirect } from "@/lib/onboarding/post-login-redirect";
import { LoginPage } from "@/views/auth/login-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in — Hearst Connect",
  description: "Sign in with your email and password to access your portfolio.",
};

export default async function LoginRoute({
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
      <LoginPage />
    </Suspense>
  );
}
