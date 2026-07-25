import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";
import {
  PROVENANCE_DESCRIPTIONS,
  PROVENANCE_LABELS,
  type Provenance,
} from "@/lib/provenance";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border border-border bg-surface-raised text-muted",
        accent: "bg-accent-muted text-accent",
        success: "bg-success/15 text-success",
        warning: "bg-warning/15 text-warning",
        danger: "bg-danger/15 text-danger",
        info: "bg-info/15 text-info",
        outline: "border border-border-subtle text-subtle",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

/**
 * Provenance chip — SOBER mapping, mirroring the catalyst ProvenanceBadge
 * doctrine (src/components/catalyst/provenance-badge.tsx):
 *   - `live` is the ONLY kind on the accent — one green, nothing else;
 *   - `oracle`/`attested` (verified sources) read a notch firmer: strong grey;
 *   - `manual`/`estimated`/`partial`/`stale` are neutral grey — stale data is
 *     data awaiting refresh, NOT an error, so it is never red;
 *   - `simulated` is outlined and carries the sandbox description as a native
 *     `title` so a demo record can never pass for a production one.
 * Red (`danger`) and any second green are FORBIDDEN here — locked by
 * src/ui/__tests__/provenance-contract.test.ts.
 */
export function ProvenanceBadge({
  source,
  className,
}: {
  source: Provenance;
  className?: string;
}) {
  const variants: Record<Provenance, BadgeProps["variant"]> = {
    live: "accent",
    oracle: "default",
    attested: "default",
    estimated: "default",
    partial: "default",
    manual: "default",
    stale: "default",
    simulated: "outline",
  };

  // Verified sources (oracle/attested) get the strong grey text; the neutral
  // kinds keep the default muted tone of the `default` variant.
  const strongGrey: Partial<Record<Provenance, string>> = {
    oracle: "text-foreground",
    attested: "text-foreground",
  };

  return (
    <Badge
      variant={variants[source]}
      title={
        source === "simulated" ? PROVENANCE_DESCRIPTIONS.simulated : undefined
      }
      className={cn(strongGrey[source], className)}
    >
      {PROVENANCE_LABELS[source]}
    </Badge>
  );
}
