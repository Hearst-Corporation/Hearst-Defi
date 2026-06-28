import Link from "next/link";

import { ErrorShellLayout } from "@/components/error/error-shell";
import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";

interface SegmentNotFoundProps {
  /** Short eyebrow label, e.g. "Produit · 404". */
  scope: string;
  /** Sober explanatory copy. */
  message: string;
  /** Link target for the recovery action. */
  homeHref?: string;
  /** Link label for the recovery action. */
  homeLabel?: string;
}

/**
 * Shared 404 fallback for Next.js segment `not-found.tsx` boundaries.
 * Server Component — no client JS, Cockpit tokens only.
 */
export function SegmentNotFound({
  scope,
  message,
  homeHref = "/",
  homeLabel = "Back to home",
}: SegmentNotFoundProps) {
  return (
    <ErrorShellLayout
      tone="warning"
      scope={scope}
      title="Page not found"
      message={message}
      actions={
        <Button variant="secondary" size="sm" asChild>
          <Link href={homeHref}>{homeLabel}</Link>
        </Button>
      }
    />
  );
}
