// "Allocation disponible" panel — the CTA-anchoring block: vault capacity
// (total / used / available), the investor's own allocation, minimum ticket,
// eligibility status, and the single "Allocate capital" CTA. Deliberately ONE
// panel with a capacity bar, not four separate KPI cards.

import { Card } from "@/components/catalyst/card";
import { Progress } from "@/components/catalyst/progress";
import { Button } from "@/components/catalyst/button";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { BentoBadge } from "@/components/catalyst/bento-badge";
import { investDepositPath } from "@/lib/vaults/invest-routes";

import type {
  ResolvedViewModel,
  VaultCapacityViewModel,
  SubscriptionViewModel,
  InvestorPositionViewModel,
} from "@/features/investor-ui/types";
import { DataUnavailable, DataNotConfigured } from "@/features/investor-ui/components/states/data-states";
import { formatUsdcAmount, parseUsdcString } from "./format";

const VAULT_ID = "hearst-yield-vault";

type CtaState =
  | "eligible"
  | "not_eligible"
  | "whitelist_required"
  | "cap_reached"
  | "closed"
  | "not_configured";

function resolveCtaState(
  subscription: SubscriptionViewModel | null,
  capacityFull: boolean,
): CtaState {
  if (!subscription) return "not_configured";
  if (!subscription.subscriptionOpen) return capacityFull ? "cap_reached" : "closed";
  if (subscription.whitelistRequired && subscription.userEligible === false) return "whitelist_required";
  if (subscription.userEligible === false) return "not_eligible";
  return "eligible";
}

const CTA_COPY: Record<CtaState, { label: string; helper: string }> = {
  eligible: { label: "Allocate capital", helper: "Start the subscription checkout." },
  not_eligible: { label: "Not eligible yet", helper: "Your account does not meet the current eligibility requirements." },
  whitelist_required: { label: "Whitelist required", helper: "This vault requires whitelist approval before subscribing." },
  cap_reached: { label: "Vault at capacity", helper: "The vault has reached its TVL cap — no capacity remains." },
  closed: { label: "Subscriptions closed", helper: "This vault is not currently accepting new subscriptions." },
  not_configured: { label: "Not configured", helper: "Subscription status is not available for this network yet." },
};

export function AllocationCapacityPanel({
  capacity,
  subscription,
  position,
}: {
  capacity: ResolvedViewModel<VaultCapacityViewModel>;
  subscription: ResolvedViewModel<SubscriptionViewModel>;
  position: ResolvedViewModel<InvestorPositionViewModel>;
}) {
  const bothNotConfigured = capacity.status === "NOT_CONFIGURED" && subscription.status === "NOT_CONFIGURED";
  const eitherUnavailable = capacity.status === "UNAVAILABLE" || subscription.status === "UNAVAILABLE";

  if (bothNotConfigured) {
    return (
      <Card className="p-[var(--ct-space-5)]">
        <span className="stat-label ct-text-muted">Available allocation</span>
        <DataNotConfigured
          label="Vault capacity"
          detail="PermissionedDynaVault v2.1 is not deployed on this network yet."
          className="mt-[var(--ct-space-3)]"
        />
      </Card>
    );
  }

  if (eitherUnavailable) {
    return (
      <Card className="p-[var(--ct-space-5)]">
        <span className="stat-label ct-text-muted">Available allocation</span>
        <DataUnavailable label="Vault capacity" className="mt-[var(--ct-space-3)]" />
      </Card>
    );
  }

  const cap = capacity.value;
  const sub = subscription.value;
  const pos = position.value;

  const tvlCap = parseUsdcString(cap?.tvlCap);
  const totalAssets = parseUsdcString(cap?.totalAssets);
  const available = parseUsdcString(cap?.availableCapacity);
  const utilizationPct = cap?.utilizationBps != null ? cap.utilizationBps / 100 : null;
  const capacityFull = available !== null && available <= 0;

  const ctaState = resolveCtaState(sub, capacityFull);
  const cta = CTA_COPY[ctaState];

  const yourAllocation = formatUsdcAmount(pos?.principal);
  const minimum = formatUsdcAmount(sub?.minimumDeposit ?? null);

  const capacityProvenance: Provenance = capacity.status === "STALE" ? "stale" : "estimated";

  return (
    <Card hoverOverlay={false} className="flex flex-col gap-[var(--ct-space-5)] p-[var(--ct-space-5)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--ct-space-2)]">
        <span className="stat-label ct-text-muted">Available allocation</span>
        <ProvenanceBadge kind={capacityProvenance} />
      </div>

      <div className="flex flex-col gap-[var(--ct-space-2)]">
        <div className="flex items-baseline justify-between gap-[var(--ct-space-2)]">
          <span className="text-[length:var(--ct-text-2xl)] font-bold ct-text-strong tabular">
            {available !== null ? formatUsdcAmount(cap?.availableCapacity) : "—"}
          </span>
          <span className="body-xs ct-text-muted">remaining of {tvlCap !== null ? formatUsdcAmount(cap?.tvlCap) : "—"} cap</span>
        </div>
        <Progress
          value={utilizationPct ?? 0}
          max={100}
          label="Vault utilization"
          fillClassName={capacityFull ? "bg-[var(--ct-text-muted)]" : "bg-[var(--ct-accent)]"}
        />
        <div className="flex justify-between body-xs ct-text-faint">
          <span>{totalAssets !== null ? formatUsdcAmount(cap?.totalAssets) : "—"} deployed</span>
          <span>{utilizationPct !== null ? `${utilizationPct.toFixed(1)}% utilized` : "—"}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-[var(--ct-space-4)] border-t border-[var(--ct-border-soft)] pt-[var(--ct-space-4)]">
        <div className="flex flex-col gap-[var(--ct-space-1)]">
          <span className="body-xs ct-text-muted">Your current allocation</span>
          <span className="body-sm font-medium ct-text-strong tabular">{yourAllocation ?? "—"}</span>
        </div>
        <div className="flex flex-col gap-[var(--ct-space-1)]">
          <span className="body-xs ct-text-muted">Minimum subscription</span>
          <span className="body-sm font-medium ct-text-strong tabular">{minimum ?? "—"}</span>
        </div>
      </div>

      <div className="flex flex-col gap-[var(--ct-space-2)] border-t border-[var(--ct-border-soft)] pt-[var(--ct-space-4)]">
        <div className="flex flex-wrap items-center gap-[var(--ct-space-2)]">
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
        </div>
        <p className="body-xs ct-text-faint m-0">{cta.helper}</p>
      </div>
    </Card>
  );
}
