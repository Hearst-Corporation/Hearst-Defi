import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { Progress } from "@/components/catalyst/progress";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { BentoBadge } from "@/components/catalyst/bento-badge";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";
import { investDepositPath } from "@/lib/vaults/invest-routes";
import { DataNotConfigured, DataUnavailable } from "@/features/investor-ui/components/states/data-states";
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
      <Card className="w-full p-[var(--ct-space-5)]">
        <DataNotConfigured label="Available capacity" detail="Vault capacity is not configured on this network." />
      </Card>
    );
  }

  if (capacity.status === "UNAVAILABLE" || subscription.status === "UNAVAILABLE") {
    return (
      <Card className="w-full p-[var(--ct-space-5)]">
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
  const provenance: Provenance = capacity.status === "STALE" ? "stale" : "estimated";

  return (
    <Card className="w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-5)] border-l-[3px] border-l-[var(--ct-asset-usdc-border)]">
      <div className="flex flex-col gap-[var(--ct-space-1)]">
        <div className="flex items-center justify-between gap-[var(--ct-space-2)]">
          <div className="flex items-center gap-[var(--ct-space-2)]">
            <AssetIcon variant="usdc" size="sm" />
            <span className="stat-label ct-text-muted">Available capacity</span>
          </div>
          <ProvenanceBadge kind={provenance} variant="compact" />
        </div>
        <span className="text-[length:var(--ct-text-3xl)] font-medium tabular tracking-tight leading-none text-[var(--ct-asset-usdc)]">
          {formatUsdc(cap?.availableCapacity) ?? "—"}
        </span>
        <span className="body-xs ct-text-faint">Subscribed in USDC · vault TVL cap</span>
      </div>

      <div className="flex flex-col gap-1.5 pt-[var(--ct-space-4)] border-t border-[var(--ct-border-soft)]">
        <div className="flex justify-between items-center body-xs">
          <span className="ct-text-muted">Vault utilization</span>
          <span className="ct-text-strong font-medium tabular">of {formatUsdc(cap?.tvlCap) ?? "—"}</span>
        </div>
        <Progress
          value={utilizationPct ?? 0}
          max={100}
          label="Vault utilization"
          fillClassName="bg-[var(--ct-chart-neutral)]"
        />
        <div className="flex justify-between mt-1 body-xs ct-text-faint">
          <span>
            Allocated: <span className="ct-text-strong">{formatUsdc(cap?.totalAssets) ?? "—"}</span>
          </span>
          <span>
            Available: <span className="text-[var(--ct-asset-usdc)]">{formatUsdc(cap?.availableCapacity) ?? "—"}</span>
          </span>
        </div>
        <div className="body-xs ct-text-faint">
          Your allocation: <span className="ct-text-strong">{formatUsdc(pos?.principal) ?? "—"}</span>
        </div>
      </div>

      <div className="flex flex-col gap-[var(--ct-space-3)] pt-[var(--ct-space-4)] border-t border-[var(--ct-border-soft)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-[var(--ct-space-2)]">
          <div className="flex flex-col">
            <span className="body-xs ct-text-muted">Minimum additional</span>
            <span className="body-sm ct-text-strong tabular font-medium">{formatUsdc(sub?.minimumDeposit) ?? "—"}</span>
          </div>
          {ctaState === "eligible" ? (
            <CockpitButton href={investDepositPath(VAULT_ID)} variant="secondary" shape="rect" size="lg">
              {cta.label}
            </CockpitButton>
          ) : (
            <div className="flex items-center gap-[var(--ct-space-2)]">
              <BentoBadge variant="flat">{ctaState.replace(/_/g, " ")}</BentoBadge>
              <CockpitButton disabled variant="secondary" shape="rect" size="lg" className="pointer-events-none">
                {cta.label}
              </CockpitButton>
            </div>
          )}
        </div>
        <p className="body-xs ct-text-faint m-0">{cta.helper}</p>
      </div>
    </Card>
  );
}
