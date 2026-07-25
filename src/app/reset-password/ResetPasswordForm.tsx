"use client";

import { useState, useTransition } from "react";

import { resetPassword } from "./actions";
import { Button, Input, Label } from "@/ui";

interface Props {
  token: string;
}

export function ResetPasswordForm({ token }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    formData.set("token", token);
    startTransition(async () => {
      const result = await resetPassword(formData);
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-4" aria-label="Set new password">
      <div className="space-y-2">
        <Label htmlFor="rp-password">New password</Label>
        <Input
          id="rp-password"
          name="password"
          type="password"
          autoComplete="new-password"
          autoFocus
          required
          minLength={8}
          disabled={isPending}
          placeholder="Min. 8 characters"
        />
      </div>

      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        disabled={isPending}
        aria-busy={isPending}
      >
        {isPending ? "Updating…" : "Set new password"}
      </Button>
    </form>
  );
}
