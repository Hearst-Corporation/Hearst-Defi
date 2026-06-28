"use client";

import Link from "next/link";
import { useEffect } from "react";

import { ErrorShellLayout } from "@/components/error/error-shell";
import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";

interface SegmentErrorProps {
  /** Error object provided by the Next.js error boundary. */
  error: Error & { digest?: string };
  /** Resets the error boundary and re-renders the segment. */
  reset: () => void;
  /** Short eyebrow label, e.g. "Dashboard · Error". */
  scope: string;
  /** Optional "back" link target (defaults to product home). */
  homeHref?: string;
  /** Optional "back" link label. */
  homeLabel?: string;
}

/**
 * Shared client fallback for Next.js segment `error.tsx` boundaries across the
 * Hearst Connect product shell. Sober copy, no raw stack leaked to the user,
 * only the opaque `digest` is surfaced for support correlation.
 */
export function SegmentError({
  error,
  reset,
  scope,
  homeHref = "/",
  homeLabel = "Return to home",
}: SegmentErrorProps) {
  useEffect(() => {
    // Local diagnostics only; production capture handled upstream (Sentry).
    console.error(`[${scope}] uncaught error`, error);
  }, [error, scope]);

  return (
    <ErrorShellLayout
      tone="danger"
      scope={scope}
      title="Something went wrong"
      message="An unexpected error interrupted this page. You may try again; if the issue persists, please contact support."
      digest={error.digest}
      actions={
        <>
          <Button variant="primary" size="sm" onClick={() => reset()}>
            Try again
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link href={homeHref}>{homeLabel}</Link>
          </Button>
        </>
      }
    />
  );
}
