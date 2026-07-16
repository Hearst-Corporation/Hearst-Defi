// Dashboard capacity panel (Zone 2 right) — allocation decision widget.
// Hierarchy: vault utilization % + Progress FIRST, figures as BentoDetailRow
// detail, then the CTA ("can I allocate more"). Every CTA state preserved
// (eligible / not_eligible / whitelist_required / cap_reached / closed /
// not_configured). Provenance via the unified toProvenance mapping
// (FIXTURE -> simulated).

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Progress } from "@/components/catalyst/progress";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { BentoBadge } from "@/components/catalyst/bento-badge";
import { BentoDetailRow } from "@/components/catalyst/bento";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";
import { investDepositPath } from "@/lib/vaults/invest-routes";
import { DataNotConfigured, DataUnavailable } from "@/features/investor-ui/components/states/data-states";
import { toProvenance, formatUsdCompactAmount } from "@/features/investor-ui/format-btc";
import type {
  ResolvedViewModel,
  VaultCapacityViewModel,
  SubscriptionViewModel,
  InvestorPositionViewModel,
} from "@/features/investor-ui/types";

const VAULT_ID = "hearst-yield-vault";

type CtaState = "eligible" | "not_eligible" | "whitelist_required" | "cap_reached" | "closed" | "not_configured";

function parseUsdc(s: string | null | undefined): number | null {
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
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

export function DashboardCapacityPanel({
  capacity,
  subscription,
  position,
}: {
  capacity: ResolvedViewModel<VaultCapacityViewModel>;
  subscription: ResolvedViewModel<SubscriptionViewModel>;
  position: ResolvedViewModel<InvestorPositionViewModel>;
}) {
  if (capacity.status === "NOT_CONFIGURED" && subscription.status === "NOT_CONFIGURED") {
    return (
      <Card className="w-full h-full p-[var(--ct-space-5)]">
        <DataNotConfigured label="Available capacity" detail="Vault capacity is not configured on this network." />
      </Card>
    );
  }

  if (capacity.status === "UNAVAILABLE" || subscription.status === "UNAVAILABLE") {
    return (
      <Card className="w-full h-full p-[var(--ct-space-5)]">
        <DataUnavailable label="Available capacity" />
      </Card>
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

  return (
    <Card
      className="w-full h-full p-[var(--ct-space-5)] border-l-[3px] border-l-[var(--ct-asset-usdc-border)]"
      contentClassName="flex h-full flex-col gap-[var(--ct-space-4)]"
    >
      {/* Utilization first — the "can I still get in" signal */}
      <div className="flex flex-col gap-[var(--ct-space-1)]">
        <div className="flex items-center justify-between gap-[var(--ct-space-2)]">
          <div className="flex items-center gap-[var(--ct-space-2)]">
            <AssetIcon variant="usdc" size="sm" />
            <span className="ct-bento-label">Available capacity</span>
          </div>
          <ProvenanceBadge kind={toProvenance(capacity.status)} variant="compact" />
        </div>
        <span className="text-[length:var(--ct-text-3xl)] font-medium tabular tracking-tight leading-none text-[var(--ct-asset-usdc)]">
          {utilizationPct != null ? `${utilizationPct.toFixed(1)}%` : "—"}
        </span>
        <span className="ct-metric-caption">Vault utilization · USDC subscriptions</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Progress
          value={utilizationPct ?? 0}
          max={100}
          label="Vault utilization"
          fillClassName="bg-[var(--ct-asset-usdc)]"
        />
        <div className="flex justify-between ct-metric-caption">
          <span>
            Allocated: <span className="ct-text-strong">{formatUsdCompactAmount(cap?.totalAssets) ?? "—"}</span>
          </span>
          <span>
            Cap: <span className="ct-text-strong">{formatUsdCompactAmount(cap?.tvlCap) ?? "—"}</span>
          </span>
        </div>
      </div>

      {/* Figures as detail rows */}
      <div className="flex flex-col pt-[var(--ct-space-2)] border-t border-[var(--ct-border-soft)]">
        <BentoDetailRow label="Available capacity">
          <span className="tabular text-[var(--ct-asset-usdc)]">{formatUsdCompactAmount(cap?.availableCapacity) ?? "—"}</span>
        </BentoDetailRow>
        <BentoDetailRow label="Your allocation">
          <span className="tabular">{formatUsdCompactAmount(pos?.principal) ?? "—"}</span>
        </BentoDetailRow>
        <BentoDetailRow label="Minimum additional">
          <span className="tabular">{formatUsdCompactAmount(sub?.minimumDeposit) ?? "—"}</span>
        </BentoDetailRow>
      </div>

      {/* CTA — all states preserved */}
      <div className="mt-auto flex flex-col gap-[var(--ct-space-2)] pt-[var(--ct-space-3)] border-t border-[var(--ct-border-soft)]">
        {ctaState === "eligible" ? (
          <CockpitButton
            href={investDepositPath(VAULT_ID)}
            variant="primary"
            shape="rect"
            size="lg"
            className="w-full justify-center"
          >
            {cta.label}
          </CockpitButton>
        ) : (
          <div className="flex items-center justify-between gap-[var(--ct-space-2)]">
            <BentoBadge variant="flat">{ctaState.replace(/_/g, " ")}</BentoBadge>
            <CockpitButton disabled variant="secondary" shape="rect" size="lg" className="pointer-events-none">
              {cta.label}
            </CockpitButton>
          </div>
        )}
        <p className="ct-metric-caption m-0">{cta.helper}</p>
      </div>
    </Card>
  );
}
