// Performance panel — take-profit progress + the ALWAYS-a-range estimated
// return (non-negotiable #1: never a single point). Uses the canonical
// ApyRange component, never hand-rolled percentages.

import Link from "next/link";

import { Card } from "@/components/catalyst/card";
import { Progress } from "@/components/catalyst/progress";
import { ApyRange } from "@/components/catalyst/apy-range";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";

import type { BtcViewModel } from "@/features/investor-ui/types";
import { DataNotConfigured, DataUnavailable } from "@/features/investor-ui/components/states/data-states";

export function PerformancePanel({ btc }: { btc: BtcViewModel }) {
  const { performance } = btc;

  if (performance.status === "NOT_CONFIGURED") {
    return (
      <Card className="p-[var(--ct-space-5)]">
        <span className="stat-label ct-text-muted">Performance</span>
        <DataNotConfigured
          label="Performance"
          detail="Take-profit progress and estimated BTC-accumulation range read from PermissionedDynaVault v2.1, not deployed on this network yet."
          className="mt-[var(--ct-space-3)]"
        />
      </Card>
    );
  }

  if (performance.status === "UNAVAILABLE" || performance.status === "ERROR" || performance.value == null) {
    return (
      <Card className="p-[var(--ct-space-5)]">
        <span className="stat-label ct-text-muted">Performance</span>
        <DataUnavailable label="Performance" className="mt-[var(--ct-space-3)]" />
      </Card>
    );
  }

  const p = performance.value;
  const takeProfitPct = p.takeProfitProgressBps != null ? p.takeProfitProgressBps / 100 : null;

  return (
    <Card hoverOverlay={false} className="flex flex-col gap-[var(--ct-space-4)] p-[var(--ct-space-5)]">
      <div className="flex items-center justify-between gap-[var(--ct-space-2)]">
        <span className="stat-label ct-text-muted">Performance</span>
        <span className="flex items-center gap-[var(--ct-space-3)]">
          {/* Drill-down: /btc left the primary rail (PROMPT 225) — this is its
              Dashboard entry point, mirroring MiningPulse's "Full mining report →". */}
          <Link href="/btc" className="body-xs ct-link-accent whitespace-nowrap">
            BTC accumulation detail →
          </Link>
          <ProvenanceBadge kind={performance.status === "STALE" ? "stale" : "estimated"} />
        </span>
      </div>

      <div className="flex flex-col gap-[var(--ct-space-2)]">
        <div className="flex items-baseline justify-between">
          <span className="body-sm ct-text-muted">Take-profit progress (+24% target)</span>
          <span className="body-sm font-medium ct-text-strong tabular">
            {takeProfitPct != null ? `${takeProfitPct.toFixed(1)}%` : "—"}
          </span>
        </div>
        <Progress
          value={takeProfitPct ?? 0}
          max={100}
          label="Take-profit progress"
          fillClassName="bg-[var(--ct-accent)]"
        />
      </div>

      <div className="flex items-baseline justify-between border-t border-[var(--ct-border-soft)] pt-[var(--ct-space-4)]">
        <span className="body-sm ct-text-muted">Estimated accumulated BTC return</span>
        {p.estimatedRangeLowBps != null && p.estimatedRangeHighBps != null ? (
          <ApyRange low={p.estimatedRangeLowBps / 100} high={p.estimatedRangeHighBps / 100} />
        ) : (
          <span className="body-sm ct-text-muted">—</span>
        )}
      </div>
      <p className="body-xs ct-text-faint m-0">
        Estimated, not guaranteed. BTC accumulates over the 24-month term and is delivered at maturity — there is no periodic cash distribution.
      </p>
    </Card>
  );
}
