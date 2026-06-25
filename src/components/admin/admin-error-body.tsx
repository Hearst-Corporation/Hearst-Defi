"use client";

import Link from "next/link";
import { useEffect } from "react";

import { ErrorShellLayout } from "@/components/error/error-shell";
import { Button } from "@/components/ui/button";

export interface AdminErrorBodyProps {
  error: Error & { digest?: string };
  reset: () => void;
  scope?: string;
  logPrefix?: string;
}

export function AdminErrorBody({
  error,
  reset,
  scope = "Error",
  logPrefix = "[admin]",
}: AdminErrorBodyProps) {
  useEffect(() => {
    console.error(`${logPrefix} uncaught error`, error);
  }, [error, logPrefix]);

  const rawMessage = error.message ?? "Unknown error.";
  const message =
    rawMessage.length > 500 ? `${rawMessage.slice(0, 500)}…` : rawMessage;

  return (
    <ErrorShellLayout
      tone="danger"
      scope={scope}
      title="Something went wrong"
      digest={error.digest}
      errorMessage={message}
      actions={
        <>
          <Button type="button" variant="primary" size="md" onClick={() => reset()}>
            Try again
          </Button>
          <Button variant="secondary" size="md" asChild>
            <Link href="/admin/dashboard">Back to admin</Link>
          </Button>
        </>
      }
    />
  );
}
