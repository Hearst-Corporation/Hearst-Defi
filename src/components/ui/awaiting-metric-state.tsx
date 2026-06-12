/**
 * AwaitingMetricState — light empty surface for a widget whose primary data
 * is missing (DS §9.3).
 */
import Link from "next/link";

import {
  EmptySurface,
  type EmptySurfaceVariant,
} from "@/components/ui/empty-surface";
import { cn } from "@/lib/cn";

export interface AwaitingMetricStateProps {
  message: string;
  detail?: string;
  link?: { label: string; href: string; ariaLabel?: string };
  variant?: EmptySurfaceVariant;
  className?: string;
}

export function AwaitingMetricState({
  message,
  detail,
  link,
  variant = "widget",
  className,
}: AwaitingMetricStateProps) {
  return (
    <EmptySurface
      message={message}
      detail={detail}
      variant={variant}
      className={cn(variant === "widget" && "h-full", className)}
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
