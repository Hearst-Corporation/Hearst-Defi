/**
 * Strategy library — read-only render of the seeded product strategies and their
 * three risk scenarios (Safe / Balanced / Opportunistic). Server component, pure
 * presentation from the typed config. Token-only, KPI-first, no invented data.
 */

import {
  PRODUCT_STRATEGIES,
  PRODUCT_FAMILY_LABEL,
  PRIORITY_LABEL,
  bpsToPct,
  type ProductStrategy,
  type ProductStrategyScenario,
} from "@/lib/product-strategies";
import { cn } from "@/lib/cn";

function pct(bps: number): string {
  return `${bpsToPct(bps)}%`;
}

function StatusDot({ status }: { status: ProductStrategy["status"] }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-(--ct-space-1_5) w-(--ct-space-1_5) rounded-(--ct-radius-full)",
        status === "active"
          ? "bg-[var(--ct-accent)]"
          : status === "draft"
            ? "bg-[var(--ct-text-tertiary)]"
            : "bg-[var(--ct-border)]",
      )}
    />
  );
}

function AllocationBar({ scenario }: { scenario: ProductStrategyScenario }) {
  const a = scenario.allocation;
  const segments = [
    { label: "Mining", bps: a.miningBps, cls: "bg-[var(--ct-accent)]" },
    { label: "BTC", bps: a.btcBps, cls: "bg-[var(--ct-text-strong)]" },
    { label: "Stable", bps: a.stableReserveBps, cls: "bg-[var(--ct-text-tertiary)]" },
    { label: "Yield", bps: a.yieldOverlayBps, cls: "bg-[var(--ct-border-strong,var(--ct-border))]" },
  ];
  return (
    <div className="flex flex-col gap-(--ct-space-1)">
      <div className="flex h-(--ct-space-2) w-full overflow-hidden rounded-(--ct-radius-full)">
        {segments.map((s) =>
          s.bps > 0 ? (
            <span
              key={s.label}
              className={s.cls}
              style={{ width: `${bpsToPct(s.bps)}%` }}
              title={`${s.label} ${pct(s.bps)}`}
            />
          ) : null,
        )}
      </div>
      <div className="flex flex-wrap gap-x-(--ct-space-3) gap-y-(--ct-space-0_5) text-[length:var(--ct-text-2xs)] ct-text-tertiary tabular-nums">
        {segments.map((s) => (
          <span key={s.label}>
            {s.label} {pct(s.bps)}
          </span>
        ))}
      </div>
    </div>
  );
}

function ScenarioCard({ scenario, highlight }: { scenario: ProductStrategyScenario; highlight: boolean }) {
  const asm = scenario.assumptions;
  const perf =
    asm.totalPerformanceLowBps !== undefined && asm.totalPerformanceHighBps !== undefined
      ? `${pct(asm.totalPerformanceLowBps)}–${pct(asm.totalPerformanceHighBps)}`
      : "—";
  const dist =
    asm.distributionTargetLowBps !== undefined && asm.distributionTargetHighBps !== undefined
      ? `${pct(asm.distributionTargetLowBps)}–${pct(asm.distributionTargetHighBps)}`
      : "—";
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-(--ct-space-3) rounded-(--ct-radius-xl) border p-(--ct-space-4)",
        highlight ? "border-[var(--ct-border-accent)] bg-surface-inset" : "border-[var(--ct-border-soft)] bg-surface-page",
      )}
    >
      <div className="flex items-baseline justify-between gap-(--ct-space-2)">
        <span className="ct-bento-label ct-text-strong">{scenario.label}</span>
        <span className="mono text-[length:var(--ct-text-2xs)] tabular-nums ct-text-tertiary">
          σ ×{asm.volatilityMultiplier} · {asm.horizonMonths}m
        </span>
      </div>
      <AllocationBar scenario={scenario} />
      <dl className="grid grid-cols-2 gap-(--ct-space-1) text-[length:var(--ct-text-xs)]">
        <dt className="ct-text-tertiary">Total perf.</dt>
        <dd className="text-right ct-text-body tabular-nums">{perf}</dd>
        <dt className="ct-text-tertiary">Monthly dist.</dt>
        <dd className="text-right ct-text-body tabular-nums">{dist}</dd>
      </dl>
      {scenario.narrativeBullets.length > 0 ? (
        <ul className="flex flex-col gap-(--ct-space-0_5) text-[length:var(--ct-text-2xs)] ct-text-faint">
          {scenario.narrativeBullets.map((b) => (
            <li key={b} className="[overflow-wrap:anywhere]">
              · {b}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function StrategyLibrary() {
  return (
    <div className="flex flex-col gap-(--ct-space-8) p-(--ct-space-5)">
      {PRODUCT_STRATEGIES.map((s) => (
        <article key={s.id} className="flex flex-col gap-(--ct-space-4)">
          <header className="flex flex-col gap-(--ct-space-1) border-b border-[var(--ct-border-soft)] pb-(--ct-space-3)">
            <div className="flex flex-wrap items-center gap-x-(--ct-space-2) gap-y-(--ct-space-1)">
              <StatusDot status={s.status} />
              <span className="body-sm ct-text-strong">{s.name}</span>
              {s.isFallback ? (
                <span className="ct-section-label ct-text-tertiary">fallback</span>
              ) : null}
            </div>
            <p className="text-[length:var(--ct-text-xs)] ct-text-body [overflow-wrap:anywhere]">{s.description}</p>
            <div className="flex flex-wrap gap-x-(--ct-space-3) gap-y-(--ct-space-1) text-[length:var(--ct-text-2xs)] ct-text-tertiary">
              <span>{PRODUCT_FAMILY_LABEL[s.productFamily]}</span>
              <span>· default {s.defaultRiskProfile}</span>
              <span>· {s.defaultHorizonMonths}m</span>
              <span>· {PRIORITY_LABEL[s.defaultPriority]}</span>
              <span>· {s.status}</span>
            </div>
          </header>
          <div className="grid gap-(--ct-space-4) sm:grid-cols-2 lg:grid-cols-3">
            <ScenarioCard scenario={s.scenarios.safe} highlight={false} />
            <ScenarioCard scenario={s.scenarios.balanced} highlight />
            <ScenarioCard scenario={s.scenarios.opportunistic} highlight={false} />
          </div>
        </article>
      ))}
    </div>
  );
}
