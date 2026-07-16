// VerifiedActivityTimeline — unified activity + alerts + contextual proofs.
// No "Distributions" category in investor experience.

import Link from "next/link";

import { BentoBadge } from "@/components/catalyst/bento-badge";
import { cn } from "@/lib/cn";

import type {
  ResolvedViewModel,
  ActivityItemViewModel,
  AlertViewModel,
  ProofSummaryViewModel,
} from "@/features/investor-ui/types";
import { DataUnavailable } from "@/features/investor-ui/components/states/data-states";

const ACTIVITY_ICONS: Record<string, string> = {
  deposit: "$",
  withdraw: "↩",
  claim: "₿",
  rebalance: "⇄",
  mining_credit: "⛏",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatUsdc(s: string): string | null {
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

interface VerifiedActivityTimelineProps {
  activity: ResolvedViewModel<readonly ActivityItemViewModel[]>;
  alerts: ResolvedViewModel<readonly AlertViewModel[]>;
  proofs: ResolvedViewModel<ProofSummaryViewModel>;
  className?: string;
}

export function VerifiedActivityTimeline({
  activity,
  alerts,
  proofs,
  className,
}: VerifiedActivityTimelineProps) {
  const activityItems = activity.value ?? [];
  const alertItems = alerts.value ?? [];
  const proofMeta = proofs.value;

  const hasNothing =
    activity.status === "UNAVAILABLE" &&
    alerts.status === "UNAVAILABLE";

  if (hasNothing) {
    return (
      <div className={cn("iw-surface-primary p-[var(--ct-space-5)]", className)}>
        <DataUnavailable label="Verified activity" />
      </div>
    );
  }

  return (
    <div className={cn("iw-surface-primary flex flex-col gap-[var(--ct-space-4)] p-[var(--ct-space-5)]", className)}>
      <div className="flex flex-wrap items-center justify-between gap-[var(--ct-space-2)]">
        <span className="stat-label ct-text-muted">Verified activity</span>
        <Link href="/portfolio/activity" className="body-xs ct-link-accent">
          View all activity →
        </Link>
      </div>

      <div className="iw-timeline">
        {activityItems.slice(0, 3).map((item, i) => (
          <div key={`act-${i}`} className="iw-timeline__item">
            <span className="iw-timeline__icon iw-timeline__icon--live">
              {ACTIVITY_ICONS[item.type] ?? "•"}
            </span>
            <div className="flex min-w-0 flex-col gap-[var(--ct-space-0_5)]">
              <span className="body-sm ct-text-strong capitalize">
                {item.type === "deposit" ? "Capital allocation confirmed" : item.type.replace(/_/g, " ")}
              </span>
              <span className="body-xs ct-text-muted">
                {formatUsdc(item.amountUsdc) ?? "—"} · {formatDate(item.occurredAt)}
              </span>
            </div>
            {item.txHash ? (
              <Link href={`/proof-center`} className="body-xs ct-link-accent shrink-0">
                View proof
              </Link>
            ) : null}
          </div>
        ))}

        {proofMeta && proofMeta.totalProofs > 0 ? (
          <div className="iw-timeline__item">
            <span className="iw-timeline__icon">✓</span>
            <div className="flex min-w-0 flex-col gap-[var(--ct-space-0_5)]">
              <span className="body-sm ct-text-strong">Custody attestation updated</span>
              <span className="body-xs ct-text-muted">
                {proofMeta.latestProofAt ? formatDate(proofMeta.latestProofAt) : "—"} ·{" "}
                {proofMeta.types.join(", ")}
              </span>
            </div>
            <Link href="/proof-center" className="body-xs ct-link-accent shrink-0">
              View attestation
            </Link>
          </div>
        ) : null}

        {alertItems.slice(0, 2).map((a) => (
          <div key={a.code} className="iw-timeline__item">
            <span className="iw-timeline__icon">!</span>
            <div className="flex min-w-0 flex-col gap-[var(--ct-space-0_5)]">
              <span className="body-sm ct-text-strong">{a.message}</span>
              <BentoBadge variant={a.severity === "warning" ? "warning" : "default"}>{a.severity}</BentoBadge>
            </div>
          </div>
        ))}
      </div>

      <p className="body-xs ct-text-faint m-0">
        Bitcoin accumulates over the product term and is delivered at maturity — not as periodic payouts.
      </p>
    </div>
  );
}
