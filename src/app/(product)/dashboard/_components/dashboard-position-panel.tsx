import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { DataNotConfigured, DataUnavailable } from "@/features/investor-ui/components/states/data-states";
import type { ResolvedViewModel, InvestorPositionViewModel, MiningViewModel } from "@/features/investor-ui/types";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { investDepositPath } from "@/lib/vaults/invest-routes";
import Link from "next/link";
import { HeroPanel } from "@/features/investor-ui/components/widgets/hero-panel";

const VAULT_ID = "hearst-yield-vault";

function formatUsdc(decimal: string | null): string | null {
  if (decimal == null) return null;
  const n = Number(decimal);
  if (!Number.isFinite(n)) return null;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function satsToBtc(sats: string | null | undefined): string | null {
  if (sats == null) return null;
  const n = Number(sats);
  if (!Number.isFinite(n)) return null;
  return (n / 1e8).toFixed(6);
}

const STATUS_TO_PROVENANCE: Record<string, Provenance> = {
  FIXTURE: "estimated",
  LIVE: "live",
  STALE: "stale",
  PARTIAL: "partial",
};

export function DashboardPositionPanel({
  position,
  mining,
}: {
  position: ResolvedViewModel<InvestorPositionViewModel>;
  mining: MiningViewModel;
}) {
  if (position.status === "NOT_CONFIGURED") {
    return (
      <Card className="w-full p-[var(--ct-space-5)]">
        <DataNotConfigured label="Position" detail="PermissionedDynaVault v2.1 is not deployed on this network yet." />
      </Card>
    );
  }

  if (position.status === "UNAVAILABLE" || position.status === "ERROR") {
    return (
      <Card className="w-full p-[var(--ct-space-5)]">
        <DataUnavailable label="Position" />
      </Card>
    );
  }

  const value = position.value;

  if (value == null || value.positionsCount === 0) {
    return (
      <Card className="w-full flex items-center justify-center p-[var(--ct-space-8)]">
        <div className="flex flex-col items-center gap-[var(--ct-space-3)] text-center">
          <span className="stat-label ct-text-strong">No active position yet</span>
          <span className="body-sm ct-text-muted">Subscribe to the Hearst Mining Note to start accumulating Bitcoin.</span>
          <CockpitButton href={investDepositPath(VAULT_ID)} variant="secondary" shape="rect" size="lg" className="mt-[var(--ct-space-2)]">
            Allocate capital
          </CockpitButton>
        </div>
      </Card>
    );
  }

  const miningVal = mining.mining.value;
  const currentMonth = miningVal?.currentMonth ?? null;
  const totalMonths = miningVal?.productDurationMonths ?? 24;
  const btcAccumulated = satsToBtc(miningVal?.totalBtcEarnedSats);
  const provenance = STATUS_TO_PROVENANCE[position.status] ?? "manual";

  return (
    <HeroPanel
      title="Current position"
      mainValue={formatUsdc(value.value) ?? "—"}
      provenance={provenance}
      metrics={[
        { label: "Capital allocated", value: formatUsdc(value.principal) ?? "—" },
        { label: "BTC accumulated", value: btcAccumulated != null ? `${btcAccumulated} BTC` : "—", accent: true },
        { label: "Current BTC value", value: formatUsdc(value.accrued) ?? "—" },
      ]}
      progress={currentMonth != null ? {
        current: currentMonth,
        total: totalMonths,
        label: "Product term progress"
      } : undefined}
      action={
        <Link href="/btc" className="body-xs ct-link-accent whitespace-nowrap">
          View Bitcoin →
        </Link>
      }
    />
  );
}
