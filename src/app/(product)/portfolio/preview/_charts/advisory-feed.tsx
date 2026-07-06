/**
 * AdvisoryFeed — the deterministic (Chainlink) rebalancing advisory as a one-line activity feed
 * (Application UI V4 `feeds/03` spine × `stacked-lists/17` row). Severity node on a connector spine +
 * agent + one-line headline + provenance chip + relative timestamp + Review deep-link. All prose
 * (signal/PTAI/evidence/disclaimer) lives behind the link — the big "less text" cut. Read-only, no
 * execute affordance. Green node only for Live/Attested (data-enforced). Token-only. Server component.
 */
import Link from "next/link";

import { ProvenanceBadge } from "@/components/ui/provenance-badge";

import type { AgentSignal, SignalSeverity } from "./agent-signal-card";

const SEV: Record<SignalSeverity, string> = {
  green: "var(--ct-status-success)",
  amber: "var(--ct-status-warning)",
  red: "var(--ct-status-danger)",
  info: "var(--ct-status-info)",
};

export function AdvisoryFeed({ signals }: { signals: readonly AgentSignal[] }) {
  return (
    <ul role="list" className="flex flex-col">
      {signals.map((s, i) => {
        const prov = s.evidence[0]?.provenance ?? "estimated";
        const last = i === signals.length - 1;
        return (
          <li key={s.agent} className="relative flex gap-3 pb-4 last:pb-0">
            {!last ? (
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-[3px] top-4 w-px"
                style={{ background: "var(--ct-border-soft)" }}
              />
            ) : null}
            <span
              aria-hidden="true"
              className="relative mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: SEV[s.severity], color: SEV[s.severity], boxShadow: "var(--ct-glow-dot)" }}
            />
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="ct-bento-label shrink-0">{s.agent}</span>
              <span className="min-w-0 flex-1 truncate text-[length:var(--ct-text-xs)] ct-text-body">
                {s.headline}
              </span>
              <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                <ProvenanceBadge kind={prov} variant="compact" />
                <span className="ct-metric-caption text-[length:var(--ct-text-nano)]">{s.observedAt}</span>
              </span>
              <Link
                href={s.reviewHref}
                className="shrink-0 text-[length:var(--ct-text-nano)] uppercase tracking-widest ct-text-muted transition-colors hover:text-[var(--ct-accent)]"
              >
                Review →
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
