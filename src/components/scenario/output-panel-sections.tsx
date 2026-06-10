// Shared presentational sections for the Scenario Lab OutputPanel.
// Each section renders the SAME data in one of two visual densities:
//   - "full"    → Card-based, large type (single-scenario view)
//   - "compact" → glass-panel-subtle, condensed (side-by-side compare view)
// No business logic here: all maths live in src/lib/engine/*. These components
// only format engine output for display.

import { ApyRange } from "@/components/ui/apy-range";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import {
  BUCKET_COLOR,
  BUCKET_LABEL,
  CONFIDENCE_VARIANT,
  MODE_LABEL,
  MODE_VARIANT,
  progressScoreFillClass,
} from "@/lib/constants/scenario";
import { cn } from "@/lib/cn";
import type { ScenarioOutput } from "@/lib/engine/types";

export type OutputVariant = "full" | "compact";

// ── APY hero ────────────────────────────────────────────────────────────────

export function ApyHero({
  output,
  variant,
  delta,
}: {
  output: ScenarioOutput;
  variant: OutputVariant;
  /** Optional delta line rendered under the hero (compare side B). */
  delta?: React.ReactNode;
}) {
  const apy = (
    <ApyRange
      low={output.apy_range.low}
      high={output.apy_range.high}
      className={cn(
        "mono text-4xl font-extrabold tabular-nums",
        "ct-text-strong leading-none",
      )}
    />
  );

  const confidence = (
    <div
      className={cn(
        "flex flex-col items-end",
        variant === "full" ? "gap-1.5" : "gap-1",
      )}
    >
      <span className={cn("stat-label", variant === "compact" && "text-micro")}>
        Confidence
      </span>
      <Badge
        variant={CONFIDENCE_VARIANT[output.confidence]}
        className={variant === "full" ? "text-xs" : "text-micro"}
      >
        {output.confidence.toUpperCase()}
      </Badge>
    </div>
  );

  if (variant === "full") {
    return (
      <Card>
        <CardHeader className="mb-4">
          <CardTitle>Projected APY Range</CardTitle>
          <ProvenanceBadge kind="estimated" />
        </CardHeader>

        <div className="flex flex-wrap items-end justify-between gap-4">
          {apy}
          {confidence}
        </div>

        <div className="mt-4 border-t border-[var(--ct-border-soft)] pt-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="stat-label">Stressed APY</span>
            <ProvenanceBadge kind="estimated" />
          </div>
          <span className="mono text-2xl font-extrabold tabular-nums ct-text-primary">
            {output.stressed_apy.toFixed(1)}%
          </span>
          <span className="ml-2 text-xs ct-text-muted">
            bear scenario floor
          </span>
        </div>
      </Card>
    );
  }

  return (
    <div className="glass-panel-subtle p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <h4 className="h4 ct-text-strong">Projected APY</h4>
        <ProvenanceBadge kind="estimated" />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        {apy}
        {confidence}
      </div>

      {delta}
    </div>
  );
}

// ── Risk + Mining 2-up grid ───────────────────────────────────────────────────

function ScoreCard({
  variant,
  label,
  value,
  fillClassName,
  caption,
  footer,
}: {
  variant: OutputVariant;
  label: string;
  value: number;
  fillClassName: string;
  caption?: string;
  footer?: React.ReactNode;
}) {
  const labelCls = cn("stat-label", variant === "compact" && "text-micro");
  const numberCls =
    variant === "full"
      ? "mono text-2xl font-extrabold tabular-nums ct-text-primary"
      : "mono text-xl font-extrabold tabular-nums ct-text-primary";
  const slashCls =
    variant === "full"
      ? "text-sm ct-text-muted"
      : "text-xs ct-text-muted";

  const body = (
    <>
      <div
        className={cn(
          "flex items-center justify-between gap-2",
          variant === "full" ? "mb-3" : "mb-2",
        )}
      >
        <span className={labelCls}>{label}</span>
        <ProvenanceBadge kind="estimated" />
      </div>
      <div className="mb-1 flex items-baseline gap-1">
        <span className={numberCls}>{value.toFixed(0)}</span>
        <span className={slashCls}>/100</span>
      </div>
      <Progress
        value={value}
        fillClassName={fillClassName}
        className={variant === "full" ? "mt-2" : "mt-1.5"}
      />
      {footer}
      {caption && (
        <p
          className={cn(
            variant === "full"
              ? "mt-2 text-xs ct-text-muted"
              : "mt-2 text-micro ct-text-muted",
          )}
        >
          {caption}
        </p>
      )}
    </>
  );

  if (variant === "full") return <Card>{body}</Card>;
  return <div className="glass-panel-subtle p-4">{body}</div>;
}

export function ScoreGrid({
  output,
  variant,
  riskFooter,
}: {
  output: ScenarioOutput;
  variant: OutputVariant;
  /** Optional delta line under the risk score (compare side B). */
  riskFooter?: React.ReactNode;
}) {
  const riskColorClass = progressScoreFillClass(output.risk_score, true);
  const miningColorClass = progressScoreFillClass(
    output.mining_margin_score,
    false,
  );

  return (
    <div
      className={cn(
        "grid sm:grid-cols-2",
        variant === "full" ? "gap-4" : "gap-3",
      )}
    >
      <ScoreCard
        variant={variant}
        label="Risk Score"
        value={output.risk_score}
        fillClassName={riskColorClass}
        caption={variant === "full" ? "Lower = lower risk" : undefined}
        footer={riskFooter}
      />
      <ScoreCard
        variant={variant}
        label="Mining Margin"
        value={output.mining_margin_score}
        fillClassName={miningColorClass}
        caption={variant === "full" ? "Current vs target" : "Current vs target"}
      />
    </div>
  );
}

// ── Vault mode ────────────────────────────────────────────────────────────────

export function VaultMode({
  output,
  variant,
}: {
  output: ScenarioOutput;
  variant: OutputVariant;
}) {
  const inner = (
    <div
      className={cn(
        "flex items-center justify-between",
        variant === "full" ? "gap-4" : "gap-3",
      )}
    >
      <div>
        <p className={cn("stat-label", variant === "full" ? "mb-1" : "text-micro")}>
          Vault Mode
        </p>
        <p
          className={cn(
            "ct-text-muted",
            variant === "full" ? "text-xs" : "mt-0.5 text-micro",
          )}
        >
          {variant === "full" ? "Current allocation posture" : "Allocation posture"}
        </p>
      </div>
      <Badge
        variant={MODE_VARIANT[output.mode]}
        className={
          variant === "full" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-xs"
        }
      >
        {MODE_LABEL[output.mode]}
      </Badge>
    </div>
  );

  if (variant === "full") return <Card>{inner}</Card>;
  return <div className="glass-panel-subtle p-4">{inner}</div>;
}

// ── Allocation ────────────────────────────────────────────────────────────────

function AllocationBar({
  allocations,
}: {
  allocations: ScenarioOutput["allocations"];
}) {
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full">
      {allocations.map((a) => (
        <div
          key={a.bucket}
          className="ct-alloc-bar-segment"
          style={{ width: `${a.pct}%`, color: BUCKET_COLOR[a.bucket] }}
          title={`${BUCKET_LABEL[a.bucket]}: ${a.pct.toFixed(0)}%`}
        />
      ))}
    </div>
  );
}

export function AllocationSection({
  output,
  variant,
}: {
  output: ScenarioOutput;
  variant: OutputVariant;
}) {
  const yieldHeader = variant === "full" ? "Yield contribution" : "Yield";

  const table = (
    <div className={variant === "full" ? "mt-4" : undefined}>
      <div
        className={cn(
          "grid grid-cols-[1fr_auto_auto] text-micro font-semibold uppercase tracking-[var(--ct-tracking-wide)] ct-text-muted",
          variant === "full" ? "mb-2 gap-x-4" : "mb-1.5 gap-x-3",
        )}
      >
        <span>Bucket</span>
        <span className="text-right">Pct</span>
        <span className="text-right">{yieldHeader}</span>
      </div>
      <ul className="divide-y divide-[var(--ct-border-soft)]">
        {output.allocations.map((a) => (
          <li
            key={a.bucket}
            className={cn(
              "grid grid-cols-[1fr_auto_auto] items-center text-sm",
              variant === "full"
                ? "gap-x-4 py-2.5 first:pt-1 last:pb-1"
                : "gap-x-3 py-1.5 first:pt-0.5 last:pb-0.5",
            )}
          >
            <span className="flex min-w-0 items-center gap-2 ct-text-body">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full shadow-[var(--ct-glow-dot)] bg-current"
                style={{ color: BUCKET_COLOR[a.bucket] }}
                aria-hidden
              />
              {variant === "full" ? (
                BUCKET_LABEL[a.bucket]
              ) : (
                <span className="truncate">{BUCKET_LABEL[a.bucket]}</span>
              )}
            </span>
            <span className="text-right mono tabular-nums ct-text-primary">
              {a.pct.toFixed(0)}%
            </span>
            <span
              className={cn(
                "text-right mono tabular-nums ct-text-muted",
                variant === "compact" && "text-xs",
              )}
            >
              {a.yield_contribution_bps > 0
                ? variant === "full"
                  ? `+${a.yield_contribution_bps} bps`
                  : `+${a.yield_contribution_bps}bps`
                : variant === "full"
                  ? "P&L variable"
                  : "P&L"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );

  if (variant === "full") {
    return (
      <Card>
        <CardHeader className="mb-4">
          <CardTitle>Allocation</CardTitle>
          <ProvenanceBadge kind="estimated" />
        </CardHeader>
        <AllocationBar allocations={output.allocations} />
        {table}
      </Card>
    );
  }

  return (
    <div className="glass-panel-subtle p-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <h4 className="h4 ct-text-strong">Allocation</h4>
        <ProvenanceBadge kind="estimated" />
      </div>
      {table}
    </div>
  );
}
