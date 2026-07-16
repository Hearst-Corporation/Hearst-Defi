// BitcoinHero — open horizontal hero: position, capital, BTC accumulated, orbit.

import Link from "next/link";

import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { Button } from "@/components/catalyst/button";
import { investDepositPath } from "@/lib/vaults/invest-routes";
import { cn } from "@/lib/cn";

import type { ResolvedViewModel, InvestorPositionViewModel, MiningViewModel } from "@/features/investor-ui/types";
import { DataUnavailable, DataNotConfigured } from "@/features/investor-ui/components/states/data-states";
import { BitcoinOrbit } from "./bitcoin-orbit";
import { ProductProgress } from "./product-progress";

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

interface BitcoinHeroProps {
  position: ResolvedViewModel<InvestorPositionViewModel>;
  mining: MiningViewModel;
  className?: string;
}

export function BitcoinHero({ position, mining, className }: BitcoinHeroProps) {
  if (position.status === "NOT_CONFIGURED") {
    return (
      <div className={cn("iw-surface-primary p-[var(--ct-space-5)]", className)}>
        <DataNotConfigured label="Position" detail="PermissionedDynaVault v2.1 is not deployed on this network yet." />
      </div>
    );
  }

  if (position.status === "UNAVAILABLE" || position.status === "ERROR") {
    return (
      <div className={cn("iw-surface-primary p-[var(--ct-space-5)]", className)}>
        <DataUnavailable label="Position" />
      </div>
    );
  }

  const value = position.value;

  if (value == null || value.positionsCount === 0) {
    return (
      <div className={cn("iw-surface-primary p-[var(--ct-space-5)]", className)}>
        <EmptySurface
          variant="widget"
          message="No active position yet"
          detail="Subscribe to the Hearst Mining Note to start accumulating Bitcoin."
        >
          <Button href={investDepositPath(VAULT_ID)} color="dark/white" className="mt-[var(--ct-space-3)]">
            Allocate capital
          </Button>
        </EmptySurface>
      </div>
    );
  }

  const miningVal = mining.mining.value;
  const currentMonth = miningVal?.currentMonth ?? null;
  const totalMonths = miningVal?.productDurationMonths ?? 24;
  const progressPct =
    currentMonth != null && totalMonths > 0 ? (currentMonth / totalMonths) * 100 : 0;
  const btcAccumulated = satsToBtc(miningVal?.totalBtcEarnedSats);
  const provenance = STATUS_TO_PROVENANCE[position.status] ?? "manual";

  return (
    <div
      className={cn(
        "iw-surface-open flex flex-col gap-[var(--ct-space-4)] lg:flex-row lg:items-center lg:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-[var(--ct-space-3)]">
        <div className="flex items-center gap-[var(--ct-space-2)]">
          <span className="stat-label ct-text-muted">Current position</span>
          <ProvenanceBadge kind={provenance} variant="compact" />
        </div>
        <span className="text-[length:2rem] font-bold tracking-tight ct-text-strong tabular leading-none">
          {formatUsdc(value.value) ?? "—"}
        </span>
        <div className="flex flex-wrap gap-x-[var(--ct-space-5)] gap-y-[var(--ct-space-2)] body-sm ct-text-muted">
          <span>
            Capital allocated{" "}
            <span className="ct-text-body font-medium tabular">{formatUsdc(value.principal) ?? "—"}</span>
          </span>
          <span>
            BTC accumulated{" "}
            <span className="ct-text-body font-medium tabular text-[var(--ct-accent)]">
              {btcAccumulated != null ? `${btcAccumulated} BTC` : "—"}
            </span>
          </span>
          <span>
            Current BTC value{" "}
            <span className="ct-text-body font-medium tabular">{formatUsdc(value.accrued) ?? "—"}</span>
          </span>
        </div>
        <ProductProgress
          currentMonth={currentMonth}
          totalMonths={totalMonths}
          statusLabel={value.status === "active" ? "On track" : value.status ?? undefined}
        />
        <Link href="/btc" className="body-xs ct-link-accent w-fit">
          View Bitcoin →
        </Link>
      </div>
      <BitcoinOrbit progressPct={progressPct} pulse={miningVal?.fleetActive === true} />
    </div>
  );
}
