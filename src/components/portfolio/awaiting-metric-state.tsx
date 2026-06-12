/**
 * AwaitingMetricState — light, self-contained empty surface for a widget whose
 * primary data is missing.
 *
 * Design contract (`docs/DESIGN_SYSTEM.md` §9.3):
 * **Empty states replace active module surfaces; they are not rendered inside
 * active module surfaces.**
 */
import Link from "next/link";

import { EmptySurface } from "@/components/ui/empty-surface";
import { cn } from "@/lib/cn";

export interface AwaitingMetricStateProps {
  message: string;
  detail?: string;
  link?: { label: string; href: string; ariaLabel?: string };
  className?: string;
}

export function AwaitingMetricState({
  message,
  detail,
  link,
  className,
}: AwaitingMetricStateProps) {
  return (
    <EmptySurface
      message={message}
      detail={detail}
      variant="widget"
      className={cn("h-full", className)}
    >
      {link ? (
        <Link
          href={link.href}
          aria-label={link.ariaLabel ?? link.label}
          className="body-xs ct-text-muted hover:ct-text-primary transition-colors underline underline-offset-2 decoration-(--ct-border) mt-1"
        >
          {link.label}
        </Link>
      ) : null}
    </EmptySurface>
  );
}
