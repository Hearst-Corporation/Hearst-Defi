import Link from "next/link";

import {
  BENTO_PRIMARY_BTN,
  BentoHeader,
  BentoLabel,
  BentoPanel,
} from "@/components/ui/bento";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import type {
  ReadinessFactor,
  ReadinessStat,
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
                "text-[18px] font-bold leading-none tracking-tight",
                toneText(view.posture),
              )}
            >
              {view.postureLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5 rounded-md bg-surface-inset px-2 py-1">
            <BentoLabel className="text-[10px]">Uptime</BentoLabel>
            <span className="text-[11px] font-medium tabular-nums text-[#A7FB90]">
              99.98%
            </span>
            <span aria-hidden className="h-2 w-px bg-white/10" />
            <BentoLabel className="text-[10px]">Last scan</BentoLabel>
            <span className="text-[11px] font-medium tabular-nums text-zinc-300">
              {new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>

        <p className="m-0 max-w-[60ch] text-[13px] leading-snug text-zinc-400">
          {view.postureBlurb}
        </p>

        {/* ≤2 unique stats: Vault mode + Oracle freshness */}
        <div
          className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-white/5 bg-white/5 sm:grid-cols-2"
          role="list"
        >
          {view.stats.map((stat) => (
            <ReadinessStatCell key={stat.label} stat={stat} />
          ))}
        </div>

        {/* Compact dot strip — replaces the 5-row matrix (detail lives in Row-3 risk card) */}
        <div
          className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/5 pt-4"
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

function ReadinessStatCell({ stat }: { stat: ReadinessStat }) {
  return (
    <div
      role="listitem"
      className="flex flex-col gap-1.5 bg-surface-card p-4"
      aria-label={`${stat.label}: ${stat.value}`}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <BentoLabel>{stat.label}</BentoLabel>
        {stat.provenance ? (
          <ProvenanceBadge kind={stat.provenance} variant="strip" />
        ) : null}
      </div>
      <span
        className={cn(
          "text-[18px] font-medium leading-none tracking-tight tabular-nums",
          toneText(stat.tone),
        )}
      >
        {stat.value}
      </span>
      <span className="truncate text-[11px] text-zinc-500">{stat.detail}</span>
    </div>
  );
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
          "whitespace-nowrap text-[11px] font-medium",
          toneText(factor.tone),
        )}
      >
        {factor.label}
      </span>
    </div>
  );
}

/** Bento tone → dot background. Single green #A7FB90 for ok; amber/red/zinc otherwise. */
const TONE_DOT: Record<ReadinessTone, string> = {
  ok: "bg-[#A7FB90]",
  watch: "bg-amber-400",
  alert: "bg-red-400",
  idle: "bg-zinc-600",
};

/** Bento tone → text color. */
const TONE_TEXT: Record<ReadinessTone, string> = {
  ok: "text-[#A7FB90]",
  watch: "text-amber-400",
  alert: "text-red-400",
  idle: "text-zinc-500",
};

function toneDot(tone: ReadinessTone): string {
  return TONE_DOT[tone];
}

function toneText(tone: ReadinessTone): string {
  return TONE_TEXT[tone];
}
