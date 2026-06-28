// Shared presentational sections for the Scenario Lab OutputPanel.
// Each section renders the SAME data in one of two visual densities:
//   - "full"    → Card-based, large type (single-scenario view)
//   - "compact" → flat sections inside one compare panel (divide-y, no nested boxes)
// No business logic here: all maths live in src/lib/engine/*. These components
// only format engine output for display.

import { ApyRange } from "@/components/catalyst/apy-range";
import { BentoBadge as Badge } from "@/components/catalyst/bento-badge";
import { Card, CardHeader, CardTitle } from "@/components/catalyst/card";
import { Progress } from "@/components/catalyst/progress";
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

function CompactSection({ children }: { children: React.ReactNode }) {
  return <div className="py-[var(--ct-space-4)]">{children}</div>;
}

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
        "mono stat-value tabular-nums",
        "ct-text-strong leading-tight",
      )}
    />
  );

  const confidence = (
    <div
      className={cn(
        "flex flex-col items-end",
        variant === "full" ? "admin-doc-stack--dense" : "admin-doc-stack--compact",
      )}
    >
      <span className="stat-label">
        Confidence
      </span>
      <Badge
        variant={CONFIDENCE_VARIANT[output.confidence]}
      >
        {output.confidence.toUpperCase()}
      </Badge>
    </div>
  );

  if (variant === "full") {
    return (
      <Card>
        <CardHeader className="mb-[var(--ct-space-4)]">
          <CardTitle>Projected APY Range</CardTitle>
          <ProvenanceBadge kind="estimated" />
        </CardHeader>

        <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--end admin-doc-inline-row--relaxed flex-wrap pt-[var(--ct-space-1)]">
          {apy}
          {confidence}
        </div>

        <div className="mt-[var(--ct-space-4)] border-t border-[var(--ct-border-soft)] pt-[var(--ct-space-4)]">
          <div className="mb-[var(--ct-space-3)] admin-doc-inline-row admin-doc-inline-row--between">
            <span className="stat-label">Stressed APY</span>
            <ProvenanceBadge kind="estimated" />
          </div>
          <span className="mono stat-value tabular-nums ct-text-primary">
            {output.stressed_apy.toFixed(1)}%
          </span>
          <span className="ml-[var(--ct-space-2)] body-xs ct-text-muted">
            bear scenario floor
          </span>
        </div>
      </Card>
    );
  }

  return (
    <CompactSection>
      <div className="mb-[var(--ct-space-3)] admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--start admin-doc-inline-row--relaxed">
        <h4 className="h4 ct-text-strong">Projected APY</h4>
        <ProvenanceBadge kind="estimated" />
      </div>

      <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--end admin-doc-inline-row--actions flex-wrap pt-[var(--ct-space-1)]">
        {apy}
        {confidence}
      </div>

      {delta}
    </CompactSection>
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
  const labelCls = "stat-label";
  const numberCls = "mono stat-value tabular-nums ct-text-primary";
  const slashCls =
    variant === "full"
      ? "body-sm ct-text-muted"
      : "body-xs ct-text-muted";

  const body = (
    <>
      <div
        className={cn(
          "admin-doc-inline-row admin-doc-inline-row--between",
          variant === "full" ? "mb-[var(--ct-space-3)]" : "mb-[var(--ct-space-2)]",
        )}
      >
        <span className={labelCls}>{label}</span>
        <ProvenanceBadge kind="estimated" />
      </div>
      <div className="mb-[var(--ct-space-1)] admin-doc-inline-row admin-doc-inline-row--baseline admin-doc-inline-row--tight">
        <span className={numberCls}>{value.toFixed(0)}</span>
        <span className={slashCls}>/100</span>
      </div>
      <Progress
        value={value}
        fillClassName={fillClassName}
        className={variant === "full" ? "mt-[var(--ct-space-2)]" : "mt-[var(--ct-space-1_5)]"}
      />
      {footer}
      {caption && (
        <p
          className={cn(
            variant === "full"
              ? "mt-[var(--ct-space-2)] body-xs ct-text-muted"
              : "mt-[var(--ct-space-2)] body-xs ct-text-faint",
          )}
        >
          {caption}
        </p>
      )}
    </>
  );

  if (variant === "full") return <Card>{body}</Card>;
  return body;
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

  const grid = (
    <div
      className={cn(
        "grid sm:grid-cols-2",
        variant === "full" ? "admin-doc-stack--relaxed" : "gap-[var(--ct-space-4)]",
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
        caption="Current vs target"
      />
    </div>
  );

  if (variant === "full") return grid;
  return <CompactSection>{grid}</CompactSection>;
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
        variant === "full" ? "admin-doc-stack--relaxed" : "admin-doc-stack--actions",
      )}
    >
      <div>
        <p className={cn("stat-label", variant === "full" && "mb-[var(--ct-space-1)]")}>
          Vault Mode
        </p>
        <p
          className={cn(
            "body-xs ct-text-muted",
            variant === "compact" && "mt-[var(--ct-space-0_5)]",
          )}
        >
          {variant === "full" ? "Current allocation posture" : "Allocation posture"}
        </p>
      </div>
      <Badge
        variant={MODE_VARIANT[output.mode]}
        className={
          variant === "full" ? "px-[var(--ct-space-4)] py-[var(--ct-space-2)] body-sm" : "px-[var(--ct-space-3)] py-[var(--ct-space-1_5)] body-xs"
        }
      >
        {MODE_LABEL[output.mode]}
      </Badge>
    </div>
  );

  if (variant === "full") return <Card>{inner}</Card>;
  return <CompactSection>{inner}</CompactSection>;
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

function AllocationTable({
  allocations,
  variant,
}: {
  allocations: ScenarioOutput["allocations"];
  variant: OutputVariant;
}) {
  const yieldHeader = variant === "full" ? "Yield contribution" : "Yield";

  return (
    <div className={variant === "full" ? "mt-[var(--ct-space-4)]" : "mt-[var(--ct-space-3)]"}>
      <div
        className={cn(
          "grid grid-cols-[1fr_auto_auto]",
          variant === "full" ? "mb-[var(--ct-space-2)] admin-doc-inline-row--relaxed" : "mb-[var(--ct-space-1_5)] admin-doc-inline-row--actions",
        )}
      >
        <span className="stat-label">Bucket</span>
        <span className="stat-label text-right">Pct</span>
        <span className="stat-label text-right">{yieldHeader}</span>
      </div>
      <ul className="divide-y divide-[var(--ct-border-soft)]">
        {allocations.map((a) => (
          <li
            key={a.bucket}
            className={cn(
              "grid grid-cols-[1fr_auto_auto] items-center",
              variant === "full"
                ? "admin-doc-inline-row--relaxed py-[var(--ct-space-2_5)] body-sm first:pt-[var(--ct-space-1)] last:pb-[var(--ct-space-1)]"
                : "admin-doc-inline-row--actions py-[var(--ct-space-1_5)] body-xs first:pt-[var(--ct-space-0_5)] last:pb-[var(--ct-space-0_5)]",
            )}
          >
            <span className="admin-doc-inline-row min-w-0 ct-text-body">
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
            <span className="text-right mono tabular-nums ct-text-muted">
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
}

/** Bar + bucket table — shared by full Allocation card and Allocation & rebalancing. */
export function AllocationBreakdown({
  allocations,
  variant,
}: {
  allocations: ScenarioOutput["allocations"];
  variant: OutputVariant;
}) {
  return (
    <>
      <AllocationBar allocations={allocations} />
      <AllocationTable allocations={allocations} variant={variant} />
    </>
  );
}

export function AllocationSection({
  output,
  variant,
}: {
  output: ScenarioOutput;
  variant: OutputVariant;
}) {
  if (variant === "full") {
    return (
      <Card>
        <CardHeader className="mb-[var(--ct-space-4)]">
          <CardTitle>Allocation</CardTitle>
          <ProvenanceBadge kind="estimated" />
        </CardHeader>
        <AllocationBreakdown allocations={output.allocations} variant="full" />
      </Card>
    );
  }

  return (
    <CompactSection>
      <div className="mb-[var(--ct-space-3)] admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--start admin-doc-inline-row--relaxed">
        <h4 className="h4 ct-text-strong">Allocation</h4>
        <ProvenanceBadge kind="estimated" />
      </div>
      <AllocationBreakdown allocations={output.allocations} variant="compact" />
    </CompactSection>
  );
}
