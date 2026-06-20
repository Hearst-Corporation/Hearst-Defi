import Link from "next/link";

import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import type {
  ReadinessFactor,
  ReadinessStat,
  ReadinessTone,
  SystemReadinessView,
} from "@/lib/admin/dashboard-readiness-view";

import { AdminLeafLink } from "./cockpit-panel-header";

/**
 * System Readiness — full-width cockpit header module for `/admin/dashboard`.
 *
 * Operator's first read: is the system ready? Folds the already-loaded board
 * data (risk factors, operator queue, proof/oracle/mining telemetry) into a
 * single supervision surface — posture + key stats + a 5-factor readiness
 * matrix. Pure presentation: data is shaped by `resolveSystemReadiness`. No
 * new fetch, no business logic. Calm dots, no glow.
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
            <h2 className="dashboard-readiness__title">System readiness</h2>
            <span
              className={cn(
                "dashboard-readiness__posture-label",
                toneText(view.posture),
              )}
            >
              {view.postureLabel}
            </span>
          </div>
          <p className="dashboard-readiness__blurb body-sm ct-text-muted m-0">
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

      <div className="dashboard-readiness__stats" role="list">
        {view.stats.map((stat) => (
          <ReadinessStatCell key={stat.label} stat={stat} />
        ))}
      </div>

      <div className="dashboard-readiness__matrix">
        <div className="dashboard-readiness__matrix-head">
          <h3 className="dashboard-panel-micro-title">Readiness matrix</h3>
          <AdminLeafLink href="/admin/vaults" label="Risk framework" />
        </div>
        <ul className="dashboard-readiness__factors" role="list">
          {view.factors.map((factor) => (
            <ReadinessFactorRow key={factor.id} factor={factor} />
          ))}
        </ul>
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
        <span className="dashboard-readiness__stat-label stat-label">
          {stat.label}
        </span>
        {stat.provenance ? (
          <ProvenanceBadge kind={stat.provenance} variant="strip" />
        ) : null}
      </div>
      <span
        className={cn(
          "dashboard-readiness__stat-value tabular",
          toneText(stat.tone),
        )}
      >
        {stat.value}
      </span>
      <span className="dashboard-readiness__stat-detail body-xs ct-text-faint truncate">
        {stat.detail}
      </span>
    </div>
  );
}

function ReadinessFactorRow({ factor }: { factor: ReadinessFactor }) {
  return (
    <li
      className="dashboard-readiness__factor"
      aria-label={`${factor.label}: ${factor.status}, ${factor.detail}`}
    >
      <span
        aria-hidden
        className={cn("dashboard-readiness__dot", toneDot(factor.tone))}
      />
      <span className="dashboard-readiness__factor-label body-sm ct-text-strong">
        {factor.label}
      </span>
      <span className={cn("dashboard-readiness__factor-status body-sm", toneText(factor.tone))}>
        {factor.status}
      </span>
      <span className="dashboard-readiness__factor-detail body-xs ct-text-faint truncate">
        {factor.detail}
      </span>
    </li>
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
