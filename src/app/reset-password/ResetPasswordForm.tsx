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
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    formData.set("token", token);
    startTransition(async () => {
      const result = await resetPassword(formData);
      if (result.ok) {
        setSuccess(true);
      } else {
        setError(result.error);
      }
    });
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <p className="body-xs ct-text-accent">
          Your password has been updated. You can now sign in with your new password.
        </p>
        <Link
          href="/login"
          className="body-xs ct-link-accent inline-block"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="space-y-4" aria-label="Set new password">
      <label className="block" htmlFor="rp-password">
        <span className="stat-label mb-1 block">New password</span>
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
