"use client";

import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { login } from "@/lib/auth/actions";
import { safeFrom } from "@/lib/safe-redirect";

/**
 * Email + password sign-in form (database auth).
 *
 * On success the `login` server action redirects (this component never sees a
 * resolved promise). On failure it returns `{ ok: false, error }`, shown inline
 * via `.ct-status-danger`. Privy is NOT used here — wallet connect happens later
 * in the payment flow.
 *
 * Design-lock: only locked primitives (`Button`, `.ct-input`, `.ct-*`). No new
 * tokens, no magic hex/px, no `dark:` modifiers.
 */
export function LoginForm() {
  const searchParams = useSearchParams();
  const from = safeFrom(searchParams.get("from"));

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      // On success the action redirects (throws NEXT_REDIRECT) and never
      // returns here; on failure we get a typed error to render inline.
      const result = await login(formData, from);
      if (result && !result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-4" aria-label="Sign in">
      <label className="block body-xs" htmlFor="login-email">
        <span className="mb-1 block ct-text-muted uppercase tracking-wide">
          Email
        </span>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          disabled={isPending}
          placeholder="you@institution.com"
          className="ct-input ct-input-bare"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
        />
      </label>

      <label className="block body-xs" htmlFor="login-password">
        <span className="mb-1 block ct-text-muted uppercase tracking-wide">
          Password
        </span>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={isPending}
          placeholder="••••••••"
          className="ct-input ct-input-bare"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
        />
      </label>

      {error ? (
        <p id="login-error" className="ct-status-danger body-xs" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-center">
        <Button
          type="submit"
          variant="primary"
          size="md"
          className="w-full max-w-48 shadow-none hover:shadow-none"
          disabled={isPending}
          aria-busy={isPending}
        >
          {isPending ? "Signing in…" : "Sign in"}
        </Button>
      </div>

      <p className="text-center body-xs ct-text-muted">
        <Link
          href="/forgot-password"
          className="ct-link-accent hover:underline"
        >
          Forgot password?
        </Link>
      </p>
    </form>
  );
}
