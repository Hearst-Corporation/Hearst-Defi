"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { forgotPassword } from "./actions";
import { Button, Input, Label } from "@/ui";

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
    <form action={onSubmit} className="space-y-4" aria-label="Forgot password">
      <div className="space-y-2">
        <Label htmlFor="fp-email">Email address</Label>
        <Input
          id="fp-email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          disabled={isPending || message !== null}
          placeholder="you@institution.com"
        />
      </div>

      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="text-xs text-accent-ink" role="status">
          {message}
        </p>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        disabled={isPending || message !== null}
        aria-busy={isPending}
      >
        {isPending ? "Sending…" : "Send reset link"}
      </Button>

      <p className="text-center text-xs text-muted">
        <Link href="/login" className="text-accent-ink hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
