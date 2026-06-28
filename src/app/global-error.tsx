"use client";

import { useEffect } from "react";

import "@/app/tokens-layer.css";
import "@/app/globals.css";
import "@/app/cockpit.css";

import { ErrorShellLayout } from "@/components/error/error-shell";
import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";

export const dynamic = "force-dynamic";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global error] uncaught error", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="m-0 flex min-h-screen items-center justify-center bg-bg text-text antialiased">
        <ErrorShellLayout
          tone="danger"
          scope="Error"
          title="Something went wrong"
          message="An unexpected error interrupted this page. You may try again; if the issue persists, please contact support."
          digest={error.digest}
          actions={
            <Button variant="primary" size="sm" onClick={() => reset()}>
              Try again
            </Button>
          }
        />
      </body>
    </html>
  );
}
