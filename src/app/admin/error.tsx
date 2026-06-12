"use client";

import Link from "next/link";
import { useEffect } from "react";

import { ErrorShellLayout } from "@/components/error/error-shell";
import { Button } from "@/components/ui/button";

interface AdminErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError({ error, reset }: AdminErrorProps) {
  useEffect(() => {
    // Surface to console for local diagnostics; production logs handled upstream.
    console.error("[admin] uncaught error", error);
  }, [error]);

  const rawMessage = error.message ?? "Unknown error.";
  const message =
    rawMessage.length > 500 ? `${rawMessage.slice(0, 500)}…` : rawMessage;

  return (
    <ErrorShellLayout
      tone="danger"
      scope="Error"
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
