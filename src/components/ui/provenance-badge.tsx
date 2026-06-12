import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

export type Provenance =
  | "live"
  | "oracle"
  | "attested"
  | "estimated"
  | "partial"
  | "manual"
  | "stale";

const labels: Record<Provenance, string> = {
  live: "Live",
  oracle: "Oracle",
  attested: "Attested",
  estimated: "Estimated",
  partial: "Partial",
  manual: "Manual",
  stale: "Stale",
};

const descriptions: Record<Provenance, string> = {
  live: "Real-time data from direct system integration",
  oracle: "Data verified by decentralized oracles",
  attested: "Data verified by third-party attestation",
  estimated: "Projection based on historical performance",
  partial: "Incomplete data from some sources",
  manual: "Data manually entered by administrators",
  stale: "Data awaiting update from source",
};

const variants: Record<
  Provenance,
  "success" | "brand" | "default" | "warning" | "danger"
> = {
  live: "success",
  oracle: "brand",
  attested: "brand",
  estimated: "default",
  partial: "default",
  manual: "default",
  stale: "default",
};

const stripDotTone: Record<Provenance, string> = {
  live: "ct-status-success",
  oracle: "ct-text-strong",
  attested: "ct-text-strong",
  estimated: "ct-text-muted",
  partial: "ct-text-muted",
  manual: "ct-text-muted",
  stale: "ct-text-muted opacity-60",
};

const compactDotTone: Record<Provenance, string> = stripDotTone;

export type ProvenanceBadgeVariant = "default" | "compact" | "strip";

interface ProvenanceBadgeProps {
  kind: Provenance;
  /** Dot-only pill for dense admin KPI rows — full label stays in tooltip + aria-label. */
  compact?: boolean;
  /** `strip` — dot only on black hero KPI strip (no glass pill). */
  variant?: ProvenanceBadgeVariant;
}

export function ProvenanceBadge({
  kind,
  compact = false,
  variant,
}: ProvenanceBadgeProps) {
  const resolved: ProvenanceBadgeVariant =
    variant ?? (compact ? "compact" : "default");

  if (resolved === "strip") {
    return (
      <Tooltip content={descriptions[kind]}>
        <span
          className={cn("provenance-badge--strip shrink-0", stripDotTone[kind])}
          aria-label={labels[kind]}
        >
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current"
          />
          <span className="sr-only">{labels[kind]}</span>
        </span>
      </Tooltip>
    );
  }

  // "stale" repeats on many cards (e.g. an investor with no positions yet) and
  // reads as alarming when stacked. Keep the information, but render it quietly
  // (reduced opacity) so it stops competing with the numbers. All other kinds
  // are unchanged.
  const muted = kind === "stale";
  const chromed = resolved !== "compact";

  return (
    <Tooltip content={descriptions[kind]}>
      <Badge
        variant={chromed ? variants[kind] : "flat"}
        aria-label={labels[kind]}
        className={
          resolved === "compact"
            ? cn(
                "dashboard-provenance-badge--compact",
                compactDotTone[kind],
                muted && "opacity-60",
              )
            : muted
              ? "shrink-0 whitespace-nowrap opacity-60"
              : "shrink-0 whitespace-nowrap"
        }
      >
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current"
        />
        <span className={resolved === "compact" ? "sr-only" : undefined}>
          {labels[kind]}
        </span>
      </Badge>
    </Tooltip>
  );
}
