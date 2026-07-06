/**
 * AdvisoryList — compact, low-text agent advisory for rebalancing.
 *
 * One line per agent: severity dot + agent + a single rebalancing-focused sentence + provenance
 * + a read-only "review" deep-link. No prose boxes, no per-row disclaimer, no execute affordance —
 * agents observe → signal → recommend a review, never execute. Institutional restraint: minimal ink.
 */
import Link from "next/link";

import { ProvenanceBadge } from "@/components/ui/provenance-badge";

import type { AgentSignal, SignalSeverity } from "./agent-signal-card";

const SEV_VAR: Record<SignalSeverity, string> = {
  green: "var(--ct-status-success)",
  amber: "var(--ct-status-warning)",
  red: "var(--ct-status-danger)",
  info: "var(--ct-status-info)",
};

export function AdvisoryList({ signals }: { signals: readonly AgentSignal[] }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)]">
      {signals.map((s, i) => {
        const prov = s.evidence[0]?.provenance ?? "estimated";
        return (
          <div
            key={s.agent}
            className={`flex items-center gap-3 px-4 py-2.5 ${
              i < signals.length - 1 ? "border-b border-[var(--ct-border-soft)]" : ""
            }`}
          >
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: SEV_VAR[s.severity], color: SEV_VAR[s.severity], boxShadow: "var(--ct-glow-dot)" }}
            />
            <span className="ct-bento-label shrink-0" style={{ minWidth: 92 }}>
              {s.agent}
            </span>
            <span className="min-w-0 flex-1 truncate text-[length:var(--ct-text-xs)] ct-text-body">
              {s.headline}
            </span>
            <span className="hidden shrink-0 sm:block">
              <ProvenanceBadge kind={prov} variant="compact" />
            </span>
            <Link
              href={s.reviewHref}
              className="group hidden shrink-0 items-center gap-1 text-[length:var(--ct-text-nano)] uppercase tracking-widest ct-text-muted transition-colors hover:text-[var(--ct-accent)] md:inline-flex"
            >
              Review
              <span aria-hidden="true" className="transition-transform ease-out group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
