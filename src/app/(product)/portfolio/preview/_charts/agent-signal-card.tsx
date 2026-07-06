/**
 * AgentSignalCard — one read-only advisory signal. Observe → signal → recommend a human
 * review. It NEVER executes: no approve/reject/execute affordance exists (the whole
 * rebalance-card action cluster is intentionally absent). Severity is a 2px left rail + dot
 * (Datadog/PagerDuty), never a full-panel fill. Evidence numbers carry a ProvenanceBadge and
 * come from loaders/engine — the agent prose can never populate the Evidence slot. Every card
 * carries an "Advisory · <provenance> evidence" label + the verbatim not-a-commitment disclaimer.
 *
 * Honesty invariant (enforced by the caller's mock data): green severity only when evidence is
 * Live/Attested; Estimated/Manual caps at amber; Simulated/mock → the neutral Data-Quality read.
 */
import Link from "next/link";

import { Ptai } from "@/components/catalyst/ptai";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";

export type SignalSeverity = "green" | "amber" | "red" | "info";
export type SignalStatus =
  | "observed"
  | "review-suggested"
  | "acknowledged"
  | "resolved";

export interface SignalEvidence {
  label: string;
  value: string;
  provenance: Provenance;
}

export interface AgentSignal {
  agent: string;
  area: string;
  severity: SignalSeverity;
  /** One-line rebalancing-focused summary for the compact advisory list. */
  headline: string;
  /** Relative timestamp for the activity feed (e.g. "2m ago"). */
  observedAt: string;
  /** Free prose signal (Mining/Risk/Data-Quality). Use `ptai` instead for Treasury/Distribution. */
  signal?: string;
  ptai?: {
    projection: string;
    trigger: string;
    action: string;
    impact: string;
  };
  evidence: readonly SignalEvidence[];
  suggestedReview: string;
  reviewHref: string;
  impactedModule: string;
  status: SignalStatus;
  /** e.g. "Advisory · Attested evidence". */
  advisoryLabel: string;
  disclaimer: string;
}

const SEVERITY_VAR: Record<SignalSeverity, string> = {
  green: "var(--ct-status-success)",
  amber: "var(--ct-status-warning)",
  red: "var(--ct-status-danger)",
  info: "var(--ct-status-info)",
};

const STATUS_LABEL: Record<SignalStatus, string> = {
  observed: "Observed",
  "review-suggested": "Review suggested",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
};

export function AgentSignalCard({ signal }: { signal: AgentSignal }) {
  const sev = SEVERITY_VAR[signal.severity];
  return (
    <div
      className="flex overflow-hidden rounded-2xl border border-[var(--ct-border)] bg-surface-card"
      style={{ boxShadow: "var(--ct-shadow-soft), var(--ct-glass-bevel-subtle)" }}
    >
      {/* severity rail — 2px, never a full-panel fill */}
      <div aria-hidden="true" className="w-0.5 shrink-0" style={{ background: sev }} />

      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-3">
        {/* header — agent · area · advisory label (left) + status (right) */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: sev, boxShadow: "var(--ct-glow-dot)", color: sev }}
            />
            <span
              className="rounded-md border px-2 py-0.5 text-[length:var(--ct-text-nano)] font-semibold uppercase tracking-widest"
              style={{
                borderColor: "var(--ct-border)",
                color: "var(--ct-text-accent)",
              }}
            >
              {signal.agent}
            </span>
            <span className="rounded-md bg-[var(--ct-surface-inset)] px-2 py-0.5 text-[length:var(--ct-text-nano)] ct-text-muted uppercase tracking-widest">
              {signal.area}
            </span>
            <span
              className="inline-flex items-center rounded-full border px-2 py-0.5 text-[length:var(--ct-text-nano)] uppercase tracking-widest ct-text-muted"
              style={{ borderColor: "var(--ct-border-soft)" }}
            >
              {signal.advisoryLabel}
            </span>
          </div>
          <span className="ct-metric-caption uppercase tracking-widest text-[length:var(--ct-text-nano)]">
            {STATUS_LABEL[signal.status]}
          </span>
        </div>

        {/* signal — prose or PTAI */}
        {signal.ptai ? (
          <Ptai
            variant="flat"
            projection={signal.ptai.projection}
            trigger={signal.ptai.trigger}
            action={signal.ptai.action}
            impact={signal.ptai.impact}
          />
        ) : signal.signal ? (
          <p className="ct-text-body text-[length:var(--ct-text-xs)] leading-snug">
            {signal.signal}
          </p>
        ) : null}

        {/* evidence — value + provenance, bound to data (not the LLM) */}
        <div className="flex flex-col gap-1 rounded-lg bg-[var(--ct-surface-inset)] p-2.5">
          {signal.evidence.map((e) => (
            <div
              key={e.label}
              className="flex items-center justify-between gap-3"
            >
              <span className="ct-bento-label min-w-0 truncate">{e.label}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="ct-metric-value text-[length:var(--ct-text-xs)] tabular-nums">
                  {e.value}
                </span>
                <ProvenanceBadge kind={e.provenance} variant="compact" />
              </span>
            </div>
          ))}
        </div>

        {/* suggested human review — passive deep-link, NOT a button */}
        <div className="flex items-start gap-2">
          <span className="ct-metric-caption shrink-0 uppercase tracking-widest text-[length:var(--ct-text-nano)]">
            Suggested review
          </span>
          <Link
            href={signal.reviewHref}
            className="group inline-flex min-w-0 items-center gap-1 text-[length:var(--ct-text-xs)] ct-text-body transition-colors hover:text-[var(--ct-accent)]"
          >
            <span className="min-w-0">{signal.suggestedReview}</span>
            <span
              aria-hidden="true"
              className="shrink-0 transition-transform ease-out group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>
        </div>

        {/* footer — impacted module + disclaimer (inline, tight) */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-t border-[var(--ct-border-soft)] pt-1.5">
          <span className="ct-metric-caption shrink-0 text-[length:var(--ct-text-nano)]">
            Impacted module · {signal.impactedModule}
          </span>
          <span className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug opacity-[var(--ct-opacity-80)]">
            {signal.disclaimer}
          </span>
        </div>
      </div>
    </div>
  );
}
