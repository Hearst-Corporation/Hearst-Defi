"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { verifyTotpChallenge } from "@/lib/auth/actions";

/**
 * Client form for the TOTP challenge step (shown after password is verified
 * but before a full session is granted).
 */
export function TotpChallengeForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await verifyTotpChallenge(formData);
      if (result && !result.ok) {
        setError(result.error);
      }
      // On success, verifyTotpChallenge redirects (throws NEXT_REDIRECT).
    });
  }

  return (
    <form
      action={onSubmit}
      className="space-y-4"
      aria-label="Two-factor authentication"
    >
      <label className="block" htmlFor="totp-challenge-code">
        <span className="stat-label mb-1 block">Authenticator code</span>
        <input
          id="totp-challenge-code"
          name="code"
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete="one-time-code"
          autoFocus
          required
          disabled={isPending}
          placeholder="123456"
          className="ct-input ct-input-bare ct-input-otp"
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
        {isPending ? "Verifying…" : "Continue"}
      </Button>

      <p className="body-xs ct-text-muted text-center">
        <Link href="/login" className="ct-link-accent">
          Start over
        </Link>
      </p>
    </form>
  );
}
