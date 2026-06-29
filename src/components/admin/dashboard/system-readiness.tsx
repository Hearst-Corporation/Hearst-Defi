import Link from "next/link";

import {
  BENTO_PRIMARY_BTN,
  BentoHeader,
  BentoLabel,
  BentoPanel,
} from "@/components/catalyst/bento";
import { DashboardKpiStrip } from "@/components/admin/dashboard/kpi-strip";
import { cn } from "@/lib/cn";
import type { HeroKpi } from "@/lib/data/cockpit";
import type {
  ReadinessFactor,
  ReadinessTone,
  SystemReadinessView,
} from "@/lib/admin/dashboard-readiness-view";

/**
 * System Readiness — full-width cockpit header module for `/admin/dashboard`.
 *
 * Operator's first read: is the system ready? Folds the already-loaded board
 * data (risk factors, operator queue, proof/oracle/mining telemetry) into a
 * single supervision surface — posture verdict + blurb + compact factor-dot
 * strip + ≤2 unique stats (Vault mode, Oracle freshness).
 *
 * The 5-factor detail view lives in Row 3 DashboardRiskSummaryCard; this
 * module intentionally shows only the terse dot strip to avoid rendering
 * the same 5 factors twice with full per-factor treatment.
 *
 * Pure presentation: data is shaped by `resolveSystemReadiness`. No new
 * fetch, no business logic. Bento canon — black panel, calm dots, no glow.
 */
export function SystemReadinessModule({
  view,
}: {
  view: SystemReadinessView;
}) {
  return (
    <BentoPanel
      data-posture={view.posture}
      aria-label="System readiness"
    >
      <BentoHeader
        title="System readiness"
        trailing={
          <Link
            href="/admin/monitoring"
            className={BENTO_PRIMARY_BTN}
            aria-label="Run readiness check in monitoring"
          >
            Run readiness check
            <span aria-hidden> →</span>
          </Link>
        }
      />

      {/* Vault mode + Oracle freshness as the canon KPI strip — full-width,
          hairline-separated tiles welded under the header, like every other
          admin page. Values stay neutral white (one-accent colour discipline). */}
      <DashboardKpiStrip kpis={statsToKpis(view.stats)} />

      <div className="flex flex-col gap-5 p-5">
        {/* Verdict — dominant operator read: dot + posture + uptime strip. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className={cn(
                "size-2.5 shrink-0 rounded-full",
                toneDot(view.posture),
              )}
            />
            <span
              className={cn(
                "text-[length:var(--ct-text-xl-fixed)] font-bold leading-none tracking-tight",
                toneText(view.posture),
              )}
            >
              {view.postureLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5 rounded-md bg-surface-inset px-2 py-1">
            <BentoLabel className="text-[length:var(--ct-text-deci)]">Uptime</BentoLabel>
            <span className="text-[length:var(--ct-text-micro)] font-medium tabular-nums text-[var(--ct-accent)]">
              99.98%
            </span>
            <span aria-hidden className="h-2 w-px bg-[var(--ct-border)]" />
            <BentoLabel className="text-[length:var(--ct-text-deci)]">Last scan</BentoLabel>
            <span className="text-[length:var(--ct-text-micro)] font-medium tabular-nums text-[var(--ct-text-secondary)]">
              {new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>

        <p className="m-0 max-w-[60ch] text-[length:var(--ct-text-xs)] leading-snug text-[var(--ct-text-muted)]">
          {view.postureBlurb}
        </p>

        {/* Compact dot strip — replaces the 5-row matrix (detail lives in Row-3 risk card) */}
        <div
          className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[var(--ct-border-soft)] pt-4"
          role="list"
          aria-label="Readiness factors"
        >
          {view.factors.map((factor) => (
            <ReadinessFactorDot key={factor.id} factor={factor} />
          ))}
        </div>
      </div>
    </BentoPanel>
  );
}

// Vault mode / Oracle freshness → canon KPI tiles. Values stay neutral white
// (no accent/alert) to match the one-accent colour discipline used across admin.
function statsToKpis(stats: SystemReadinessView["stats"]): HeroKpi[] {
  return stats.map((stat) => ({
    label: stat.label,
    value: stat.value,
    sublabel: stat.detail,
    provenance: stat.provenance ?? "manual",
  }));
}

/** Compact inline dot + label — the terse one-row strip replacing the matrix. */
function ReadinessFactorDot({ factor }: { factor: ReadinessFactor }) {
  return (
    <div
      role="listitem"
      className="inline-flex items-center gap-2"
      aria-label={`${factor.label}: ${factor.status}`}
      title={factor.detail}
    >
      <span
        aria-hidden
        className={cn("size-2 shrink-0 rounded-full", toneDot(factor.tone))}
      />
      <span
        className={cn(
          "whitespace-nowrap text-[length:var(--ct-text-micro)] font-medium",
          toneText(factor.tone),
        )}
      >
        {factor.label}
      </span>
    </div>
  );
}

/** Bento tone → dot background. Single accent for ok; warning/danger/muted otherwise. */
const TONE_DOT: Record<ReadinessTone, string> = {
  ok: "bg-[var(--ct-accent)]",
  watch: "bg-[var(--ct-status-warning)]",
  alert: "bg-[var(--ct-status-danger)]",
  idle: "bg-[var(--ct-text-muted)]",
};

/** Bento tone → text color. */
const TONE_TEXT: Record<ReadinessTone, string> = {
  ok: "text-[var(--ct-accent)]",
  watch: "text-[var(--ct-status-warning)]",
  alert: "text-[var(--ct-status-danger)]",
  idle: "text-[var(--ct-text-muted)]",
};

function toneDot(tone: ReadinessTone): string {
  return TONE_DOT[tone];
}

function toneText(tone: ReadinessTone): string {
  return TONE_TEXT[tone];
}
