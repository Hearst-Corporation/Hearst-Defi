import { Card } from "@/components/catalyst/card";
import { StepTimeline, type StepTimelineItem } from "@/components/catalyst/step-timeline";
import { BentoBadge } from "@/components/catalyst/bento-badge";
import Link from "next/link";
import type { ResolvedViewModel, ActivityItemViewModel, AlertViewModel, ProofSummaryViewModel } from "@/features/investor-ui/types";
import { DataUnavailable } from "@/features/investor-ui/components/states/data-states";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatUsdc(s: string): string | null {
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

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

  // Add alerts first
  (alerts.value ?? []).slice(0, 2).forEach((a) => {
    steps.push({
      title: a.message,
      description: <BentoBadge variant={a.severity === "warning" ? "warning" : "default"}>{a.severity}</BentoBadge>,
      tone: a.severity === "warning" ? "warning" : "neutral",
    });
  });

  // Add proof if available
  const p = proofs.value;
  if (p && p.totalProofs > 0) {
    steps.push({
      title: "Custody attestation updated",
      description: (
        <div className="flex flex-col gap-[var(--ct-space-1)]">
          <span>{p.latestProofAt ? formatDate(p.latestProofAt) : "—"} · {p.types.join(", ")}</span>
          <Link href="/proof-center" className="ct-link-accent text-[length:var(--ct-text-nano)]">View attestation</Link>
        </div>
      ),
      tone: "accent",
    });
  }

  // Add normal activity
  (activity.value ?? []).slice(0, 3).forEach((item) => {
    steps.push({
      title: item.type === "deposit" ? "Capital allocation confirmed" : item.type.replace(/_/g, " "),
      description: (
        <div className="flex flex-col gap-[var(--ct-space-1)]">
          <span>{formatUsdc(item.amountUsdc) ?? "—"} · {formatDate(item.occurredAt)}</span>
          {item.txHash && (
            <Link href="/proof-center" className="ct-link-accent text-[length:var(--ct-text-nano)]">View proof</Link>
          )}
        </div>
      ),
      tone: "neutral",
    });
  });

  return (
    <Card className="w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-5)]">
      <div className="flex items-center justify-between">
        <span className="ct-bento-label">Verified activity</span>
        <Link href="/portfolio/activity" className="body-xs ct-link-accent">
          View all activity →
        </Link>
      </div>
      
      <div>
        <StepTimeline steps={steps} aria-label="Verified activity timeline" />
      </div>

      <p className="ct-metric-caption m-0 pt-[var(--ct-space-4)] border-t border-[var(--ct-border-soft)]">
        Bitcoin accumulates over the product term and is delivered at maturity — not as periodic payouts.
      </p>
    </Card>
  );
}
