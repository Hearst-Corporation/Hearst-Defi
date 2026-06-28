"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
import { forgotPassword } from "./actions";

/**
 * Client form for the "Forgot password?" flow.
 * Sends the email to the server action and shows the anti-enumeration message.
 */
export function ForgotPasswordForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await forgotPassword(formData);
      if (result.ok) {
        setMessage(result.message);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form action={onSubmit} className="auth-form" aria-label="Forgot password">
      <label className="auth-field" htmlFor="fp-email">
        <span className="ct-form-label">Email address</span>
        <input
          id="fp-email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          disabled={isPending || message !== null}
          placeholder="you@institution.com"
          className="ct-input ct-input-bare"
        />
      </label>

      {error ? (
        <p className="ct-status-danger body-xs" role="alert">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="body-xs ct-text-accent" role="status">
          {message}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="md"
        className="w-full"
        disabled={isPending || message !== null}
        aria-busy={isPending}
      >
        {isPending ? "Sending…" : "Send reset link"}
      </Button>

      <p className="body-xs ct-text-muted text-center">
        <Link href="/login" className="ct-link-accent">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
