"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { login } from "@/lib/auth/actions";
import { safeFrom } from "@/lib/safe-redirect";
import { Button } from "@/ui/button";
import { FieldError, Input, Label } from "@/ui/input";

export function LoginForm() {
  const searchParams = useSearchParams();
  const from = safeFrom(searchParams.get("from"));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await login(formData, from);
      if (result && !result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-4" aria-label="Sign in">
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          disabled={isPending}
          placeholder="you@institution.com"
          invalid={!!error}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="login-password">Password</Label>
        <Input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={isPending}
          placeholder="••••••••"
          invalid={!!error}
        />
      </div>

      {error ? <FieldError role="alert">{error}</FieldError> : null}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-xs text-muted">
        <Link href="/forgot-password" className="hc-link">
          Forgot password?
        </Link>
      </p>
    </form>
  );
}
