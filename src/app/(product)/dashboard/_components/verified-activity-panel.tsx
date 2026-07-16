// Verified activity (Zone 4) — tightened ledger: max 5 timeline rows
// (1 alert + 1 attestation + 3 activity items), contextual proof links,
// maturity disclaimer footer preserved. Dates via the shared deterministic
// formatter (no toLocaleDateString locale drift).

import { Card } from "@/components/catalyst/card";
import { StepTimeline, type StepTimelineItem } from "@/components/catalyst/step-timeline";
import { BentoBadge } from "@/components/catalyst/bento-badge";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import Link from "next/link";
import type { ResolvedViewModel, ActivityItemViewModel, AlertViewModel, ProofSummaryViewModel } from "@/features/investor-ui/types";
import { DataUnavailable } from "@/features/investor-ui/components/states/data-states";
import { formatIsoDate, formatUsdCompactAmount, toProvenance } from "@/features/investor-ui/format-btc";

const MAX_ALERTS = 1;
const MAX_ACTIVITY = 3;

export function VerifiedActivityPanel({
  activity,
  alerts,
  proofs,
}: {
  activity: ResolvedViewModel<readonly ActivityItemViewModel[]>;
  alerts: ResolvedViewModel<readonly AlertViewModel[]>;
  proofs: ResolvedViewModel<ProofSummaryViewModel>;
}) {
  const hasNothing = activity.status === "UNAVAILABLE" && alerts.status === "UNAVAILABLE";

  if (hasNothing) {
    return (
      <Card className="w-full p-[var(--ct-space-5)]">
        <DataUnavailable label="Verified activity" />
      </Card>
    );
  }

  const steps: StepTimelineItem[] = [];

  (alerts.value ?? []).slice(0, MAX_ALERTS).forEach((a) => {
    steps.push({
      title: a.message,
      description: <BentoBadge variant={a.severity === "warning" ? "warning" : "default"}>{a.severity}</BentoBadge>,
      tone: a.severity === "warning" ? "warning" : "neutral",
    });
  });

  const p = proofs.value;
  if (p && p.totalProofs > 0) {
    steps.push({
      title: "Custody attestation updated",
      description: (
        <div className="flex flex-col gap-[var(--ct-space-1)]">
          <span>{p.latestProofAt ? formatIsoDate(p.latestProofAt) : "—"} · {p.types.join(", ")}</span>
          <Link href="/proof-center" className="ct-link-accent text-[length:var(--ct-text-nano)]">View attestation</Link>
        </div>
      ),
      tone: "accent",
    });
  }

  (activity.value ?? []).slice(0, MAX_ACTIVITY).forEach((item) => {
    steps.push({
      title: item.type === "deposit" ? "Capital allocation confirmed" : item.type.replace(/_/g, " "),
      description: (
        <div className="flex flex-col gap-[var(--ct-space-1)]">
          <span>{formatUsdCompactAmount(item.amountUsdc) ?? "—"} · {formatIsoDate(item.occurredAt)}</span>
          {item.txHash && (
            <Link href="/proof-center" className="ct-link-accent text-[length:var(--ct-text-nano)]">View proof</Link>
          )}
        </div>
      ),
      tone: "neutral",
    });
  });

  return (
    <Card className="w-full p-[var(--ct-space-5)]" contentClassName="flex flex-col gap-[var(--ct-space-4)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--ct-space-2)]">
        <span className="flex items-center gap-[var(--ct-space-2)]">
          <span className="ct-bento-label">Verified activity</span>
          <ProvenanceBadge kind={toProvenance(activity.status)} variant="compact" />
        </span>
        <Link href="/portfolio/activity" className="body-xs ct-link-accent">
          View all activity →
        </Link>
      </div>

      <StepTimeline steps={steps} aria-label="Verified activity timeline" />

      <p className="ct-metric-caption m-0 pt-[var(--ct-space-3)] border-t border-[var(--ct-border-soft)]">
        Bitcoin accumulates over the product term and is delivered at maturity — not as periodic payouts.
      </p>
    </Card>
  );
}
