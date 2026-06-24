"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { resetPassword } from "./actions";

interface Props {
  token: string;
}

/**
 * Client form for /reset-password?token=<raw>.
 * Submits to the resetPassword server action and shows success/failure inline.
 */
export function ResetPasswordForm({ token }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    formData.set("token", token);
    startTransition(async () => {
      // On success the server action signs the user in and redirects straight
      // into onboarding (NEXT_REDIRECT) — it never returns `{ ok: true }`, so
      // there is no success screen and no "go to sign in" step. We only get a
      // returned value on failure.
      const result = await resetPassword(formData);
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <form action={onSubmit} className="auth-form" aria-label="Set new password">
      <label className="auth-field" htmlFor="rp-password">
        <span className="ct-form-label">New password</span>
        <input
          id="rp-password"
          name="password"
          type="password"
          autoComplete="new-password"
          autoFocus
          required
          minLength={8}
          disabled={isPending}
          placeholder="Min. 8 characters"
          className="ct-input ct-input-bare"
        />
      </label>

      {error ? (
        <p className="ct-status-danger body-xs" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="md"
        className="w-full"
        disabled={isPending}
        aria-busy={isPending}
      >
        {isPending ? "Updating…" : "Set new password"}
      </Button>

      <p className="body-xs ct-text-muted text-center">
        <Link href="/login" className="ct-link-accent">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
