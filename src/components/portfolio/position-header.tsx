// PositionHeader — top section of /portfolio/[positionId]
// Server Component. Shows vault name, position ID, status pill, total value + delta vs principal.
// Non-negotiable #2: ProvenanceBadge on the total value metric.

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import type { PositionDetail } from "@/lib/data/portfolio";

const usdFull = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type StatusVariant = "success" | "warning" | "default";

const STATUS_VARIANT: Record<string, StatusVariant> = {
  active: "success",
  matured: "warning",
  exited: "default",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  matured: "Matured",
  exited: "Exited",
};

interface PositionHeaderProps {
  position: PositionDetail;
}

/**
 * Header block: back link, vault name + position id, status pill,
 * total value with delta vs principal.
 */
export function PositionHeader({ position }: PositionHeaderProps) {
  const totalValue = position.principalUsdc + position.accruedYieldUsdc;
  const delta = totalValue - position.principalUsdc;
  const deltaSign = delta >= 0 ? "+" : "";
  const deltaPct =
    position.principalUsdc > 0
      ? (delta / position.principalUsdc) * 100
      : 0;

  const provenance = position.source === "live" ? "live" : "stale";

  return (
    <header className="flex flex-col gap-4">
      {/* Back link */}
      <Link
        href="/portfolio"
        className="body-sm ct-text-muted inline-flex items-center gap-1 no-underline transition-opacity duration-(--ct-dur-base) hover:opacity-80"
      >
        ← Portfolio
      </Link>

      {/* Title row */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="h1 m-0 break-words">
            {position.vaultName}
          </h1>
          <span className="eyebrow tabular ct-text-muted mono">
            {position.vaultTicker} ·{" "}
            <span title={position.id}>{position.id.slice(0, 8)}&hellip;</span>
          </span>
        </div>

        <Badge variant={STATUS_VARIANT[position.status] ?? "default"}>
          {STATUS_LABEL[position.status] ?? position.status}
        </Badge>
      </div>

      {/* Total value */}
      <div
        role="region"
        aria-label="Total position value"
        className="flex items-center justify-between flex-wrap gap-4 rounded-xl border border-(--ct-border-soft) ct-surface-1 px-6 py-5"
      >
        <div className="flex flex-col gap-1 min-w-0">
          <span className="eyebrow ct-text-muted">
            Total value
          </span>
          <span className="stat-value tabular ct-text-strong mono">
            {usdFull.format(totalValue)}
          </span>
          {delta !== 0 && (
            <span
              className={cn(
                "body-sm tabular mono",
                delta >= 0 ? "ct-status-success" : "ct-status-danger"
              )}
            >
              {deltaSign}
              {usdFull.format(delta)} · {deltaSign}
              {deltaPct.toFixed(1)}%
            </span>
          )}
        </div>
        <ProvenanceBadge kind={provenance} />
      </div>
    </header>
  );
}
