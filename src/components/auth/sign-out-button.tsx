"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/actions";

/**
 * Sign out button for email/password sessions. Posts to the `logout` server
 * action which destroys the DB-backed session and redirects to /login.
 *
 * Distinct from the wallet "Disconnect" on profile/onboarding — that one is Privy
 * only and does not touch the session cookie.
 */
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}

export function SignOutButton() {
  return (
    <form action={logout}>
      <SubmitButton />
    </form>
  );
}
