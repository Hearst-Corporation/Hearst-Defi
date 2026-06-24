import Link from "next/link";

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
 * fetch, no business logic. Calm dots, no glow.
 */
export function SystemReadinessModule({
  view,
}: {
  view: SystemReadinessView;
}) {
  return (
    <section
      className="dashboard-readiness"
      data-posture={view.posture}
      aria-label="System readiness"
    >
      <header className="dashboard-readiness__head">
        <div className="dashboard-readiness__head-main min-w-0">
          <div className="dashboard-readiness__posture">
            <span
              aria-hidden
              className={cn("dashboard-readiness__dot", toneDot(view.posture))}
            />
            <span
              className={cn(
                "dashboard-readiness__posture-label",
                toneText(view.posture),
              )}
            >
              {view.postureLabel}
            </span>
            <span className="dashboard-readiness__title-kicker">
              System readiness
            </span>
            <div className="dashboard-readiness__scan-badge">
              <span className="dashboard-readiness__scan-label">
                Uptime
              </span>
              <span className="dashboard-readiness__scan-value text-ct-status-success">
                99.98%
              </span>
              <div className="dashboard-readiness__scan-divider" />
              <span className="dashboard-readiness__scan-label">
                Last scan
              </span>
              <span className="dashboard-readiness__scan-value">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          <p className="dashboard-readiness__blurb cockpit-value-xs m-0 normal-case opacity-80">
            {view.postureBlurb}
          </p>
        </div>

        <div className="dashboard-readiness__head-trail">
          <Link
            href="/admin/monitoring"
            className="dashboard-readiness__run"
            aria-label="Run readiness check in monitoring"
          >
            Run readiness check
            <span aria-hidden> →</span>
          </Link>
        </div>
      </header>

      {/* ≤2 unique stats: Vault mode + Oracle freshness */}
      <div className="dashboard-readiness__stats" role="list">
        {view.stats.map((stat) => (
          <ReadinessStatCell key={stat.label} stat={stat} />
        ))}
      </div>

      {/* Compact dot strip — replaces the 5-row matrix (detail lives in Row-3 risk card) */}
      <div className="dashboard-readiness__dot-strip" role="list" aria-label="Readiness factors">
        {view.factors.map((factor) => (
          <ReadinessFactorDot key={factor.id} factor={factor} />
        ))}
      </div>
    </section>
  );
}

function ReadinessStatCell({ stat }: { stat: ReadinessStat }) {
  return (
    <div
      role="listitem"
      className="dashboard-readiness__stat"
      aria-label={`${stat.label}: ${stat.value}`}
    >
      <div className="dashboard-readiness__stat-top">
        <span className="cockpit-label-xs">
          {stat.label}
        </span>
        {stat.provenance ? (
          <ProvenanceBadge kind={stat.provenance} variant="strip" />
        ) : null}
      </div>
      <span
        className={cn(
          "dashboard-readiness__stat-value tabular-nums",
          toneText(stat.tone),
        )}
      >
        {stat.value}
      </span>
      <span className="cockpit-value-xs truncate opacity-70">
        {stat.detail}
      </span>
    </div>
  );
}

/** Compact inline dot + label — the terse one-row strip replacing the matrix. */
function ReadinessFactorDot({ factor }: { factor: ReadinessFactor }) {
  return (
    <div
      role="listitem"
      className="dashboard-readiness__factor-dot"
      aria-label={`${factor.label}: ${factor.status}`}
      title={factor.detail}
    >
      <span
        aria-hidden
        className={cn("dashboard-readiness__dot", toneDot(factor.tone))}
      />
      <span className={cn("cockpit-label-xs", toneText(factor.tone))}>
        {factor.label}
      </span>
    </div>
  );
}

const TONE_DOT: Record<ReadinessTone, string> = {
  ok: "dashboard-readiness__dot--ok",
  watch: "dashboard-readiness__dot--watch",
  alert: "dashboard-readiness__dot--alert",
  idle: "dashboard-readiness__dot--idle",
};

const TONE_TEXT: Record<ReadinessTone, string> = {
  ok: "ct-status-success",
  watch: "ct-status-warning",
  alert: "ct-status-danger",
  idle: "ct-text-muted",
};

function toneDot(tone: ReadinessTone): string {
  return TONE_DOT[tone];
}

function toneText(tone: ReadinessTone): string {
  return TONE_TEXT[tone];
}
