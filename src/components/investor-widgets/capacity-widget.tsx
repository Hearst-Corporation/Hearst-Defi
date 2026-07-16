// CapacityWidget — vault capacity ring + allocation CTA ("Allocate more capital").

import { Progress } from "@/components/catalyst/progress";
import { Button } from "@/components/catalyst/button";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { BentoBadge } from "@/components/catalyst/bento-badge";
import { investDepositPath } from "@/lib/vaults/invest-routes";
import { cn } from "@/lib/cn";

import type {
  ResolvedViewModel,
  VaultCapacityViewModel,
  SubscriptionViewModel,
  InvestorPositionViewModel,
} from "@/features/investor-ui/types";
import { DataUnavailable, DataNotConfigured } from "@/features/investor-ui/components/states/data-states";

const VAULT_ID = "hearst-yield-vault";

type CtaState =
  | "eligible"
  | "not_eligible"
  | "whitelist_required"
  | "cap_reached"
  | "closed"
  | "not_configured";

function parseUsdc(s: string | null | undefined): number | null {
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function formatUsdc(s: string | null | undefined): string | null {
  const n = parseUsdc(s);
  if (n == null) return null;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function resolveCtaState(sub: SubscriptionViewModel | null, capacityFull: boolean): CtaState {
  if (!sub) return "not_configured";
  if (!sub.subscriptionOpen) return capacityFull ? "cap_reached" : "closed";
  if (sub.whitelistRequired && sub.userEligible === false) return "whitelist_required";
  if (sub.userEligible === false) return "not_eligible";
  return "eligible";
}

const CTA_COPY: Record<CtaState, { label: string; helper: string }> = {
  eligible: { label: "Allocate more capital", helper: "Additional allocation starts the subscription checkout." },
  not_eligible: { label: "Not eligible", helper: "Your account does not meet current eligibility requirements." },
  whitelist_required: { label: "Whitelist required", helper: "Whitelist approval is required before allocating." },
  cap_reached: { label: "Capacity reached", helper: "The vault has reached its TVL cap." },
  closed: { label: "Subscriptions closed", helper: "New allocations are not currently accepted." },
  not_configured: { label: "Not configured", helper: "Capacity data is not available on this network yet." },
};

interface CapacityWidgetProps {
  capacity: ResolvedViewModel<VaultCapacityViewModel>;
  subscription: ResolvedViewModel<SubscriptionViewModel>;
  position: ResolvedViewModel<InvestorPositionViewModel>;
  className?: string;
}

export function CapacityWidget({ capacity, subscription, position, className }: CapacityWidgetProps) {
  if (capacity.status === "NOT_CONFIGURED" && subscription.status === "NOT_CONFIGURED") {
    return (
      <div className={cn("iw-surface-primary p-[var(--ct-space-5)]", className)}>
        <DataNotConfigured label="Available capacity" detail="Vault capacity is not configured on this network." />
      </div>
    );
  }

  if (capacity.status === "UNAVAILABLE" || subscription.status === "UNAVAILABLE") {
    return (
      <div className={cn("iw-surface-primary p-[var(--ct-space-5)]", className)}>
        <DataUnavailable label="Available capacity" />
      </div>
    );
  }

  const cap = capacity.value;
  const sub = subscription.value;
  const pos = position.value;
  const available = parseUsdc(cap?.availableCapacity);
  const utilizationPct = cap?.utilizationBps != null ? cap.utilizationBps / 100 : null;
  const capacityFull = available !== null && available <= 0;
  const ctaState = resolveCtaState(sub, capacityFull);
  const cta = CTA_COPY[ctaState];
  const provenance: Provenance = capacity.status === "STALE" ? "stale" : "estimated";

  return (
    <div className={cn("iw-surface-primary flex flex-col gap-[var(--ct-space-5)] p-[var(--ct-space-5)]", className)}>
      <div className="flex flex-wrap items-center justify-between gap-[var(--ct-space-2)]">
        <span className="stat-label ct-text-muted">Available capacity</span>
        <ProvenanceBadge kind={provenance} variant="compact" />
      </div>

      <div className="grid grid-cols-1 gap-[var(--ct-space-5)] md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex flex-col gap-[var(--ct-space-3)]">
          <div>
            <span className="text-[length:var(--ct-text-2xl)] font-bold ct-text-strong tabular">
              {formatUsdc(cap?.availableCapacity) ?? "—"}
            </span>
            <span className="body-xs ct-text-muted ml-[var(--ct-space-2)]">
              of {formatUsdc(cap?.tvlCap) ?? "—"} cap
            </span>
          </div>
          <Progress
            value={utilizationPct ?? 0}
            max={100}
            label="Vault utilization"
            fillClassName={capacityFull ? "bg-[var(--ct-text-muted)]" : "bg-[var(--ct-accent)]"}
          />
          <div className="flex flex-wrap gap-[var(--ct-space-4)] body-xs ct-text-muted">
            <span>Deployed {formatUsdc(cap?.totalAssets) ?? "—"}</span>
            <span>Your allocation {formatUsdc(pos?.principal) ?? "—"}</span>
            <span>Minimum additional {formatUsdc(sub?.minimumDeposit) ?? "—"}</span>
          </div>
        </div>

        <div className="flex flex-col gap-[var(--ct-space-2)] md:items-end">
          {ctaState === "eligible" ? (
            <Button href={investDepositPath(VAULT_ID)} color="dark/white">
              {cta.label}
            </Button>
          ) : (
            <Button disabled color="zinc" className="pointer-events-none">
              {cta.label}
            </Button>
          )}
          {ctaState !== "eligible" ? (
            <BentoBadge variant="flat">{ctaState.replace(/_/g, " ")}</BentoBadge>
          ) : null}
          <p className="body-xs ct-text-faint m-0 max-w-xs md:text-right">{cta.helper}</p>
        </div>
      </div>
    </div>
  );
}
