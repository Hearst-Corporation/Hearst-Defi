// Dashboard hero — ONE dominant thing: the investor's total position value.
// Principal / accrued / status ride alongside as supporting facts, never
// competing metrics. Renders honestly across every ResolvedViewModel status.

import Link from "next/link";

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { Button } from "@/components/catalyst/button";
import { cn } from "@/lib/cn";
import { investDepositPath } from "@/lib/vaults/invest-routes";

import type { ResolvedViewModel, InvestorPositionViewModel } from "@/features/investor-ui/types";
import { DataUnavailable, DataNotConfigured } from "@/features/investor-ui/components/states/data-states";
import { formatUsdcAmount, formatIsoDate } from "./format";

const VAULT_ID = "hearst-yield-vault";

const STATUS_TO_PROVENANCE: Record<string, Provenance> = {
  FIXTURE: "estimated",
  LIVE: "live",
  STALE: "stale",
  PARTIAL: "partial",
};

function statusToProvenance(status: string): Provenance {
  return STATUS_TO_PROVENANCE[status] ?? "manual";
}

export function DashboardHero({
  position,
}: {
  position: ResolvedViewModel<InvestorPositionViewModel>;
}) {
  if (position.status === "NOT_CONFIGURED") {
    return (
      <Card className="p-[var(--ct-space-6)]">
        <DataNotConfigured label="Position" detail="PermissionedDynaVault v2.1 is not deployed on this network yet." />
      </Card>
    );
  }

  if (position.status === "UNAVAILABLE" || position.status === "ERROR") {
    return (
      <Card className="p-[var(--ct-space-6)]">
        <DataUnavailable label="Position" />
      </Card>
    );
  }

  const value = position.value;

  // Honest zero-position state: signed-in, no active position yet.
  if (value == null || value.positionsCount === 0) {
    return (
      <Card className="p-[var(--ct-space-6)]">
        <div className="flex flex-col gap-[var(--ct-space-1)]">
          <span className="stat-label ct-text-muted">Your position</span>
        </div>
        <EmptySurface
          variant="widget"
          message="No active position yet"
          detail="Subscribe to the Hearst Mining Note to start accumulating BTC across the three pockets."
          className="mt-[var(--ct-space-4)]"
        >
          <Button href={investDepositPath(VAULT_ID)} color="dark/white" className="mt-[var(--ct-space-3)]">
            Allocate capital
          </Button>
        </EmptySurface>
      </Card>
    );
  }

  const totalValue = formatUsdcAmount(value.value);
  const principal = formatUsdcAmount(value.principal);
  const accrued = formatUsdcAmount(value.accrued);
  const subscribedAt = formatIsoDate(value.subscribedAt);
  const provenance = statusToProvenance(position.status);

  return (
    <Card hoverOverlay={false} className="p-[var(--ct-space-6)]">
      <div className="flex flex-wrap items-start justify-between gap-[var(--ct-space-4)]">
        <div className="flex min-w-0 flex-col gap-[var(--ct-space-2)]">
          <div className="flex items-center gap-[var(--ct-space-2)]">
            <span className="stat-label ct-text-muted">Your position — Hearst Mining Note</span>
            <ProvenanceBadge kind={provenance} />
          </div>
          <span className="text-[length:2.25rem] font-bold tracking-tight ct-text-strong tabular">
            {totalValue ?? "—"}
          </span>
          <div className="flex flex-wrap items-center gap-[var(--ct-space-4)] body-xs ct-text-muted">
            <span>
              Principal <span className="ct-text-body font-medium">{principal ?? "—"}</span>
            </span>
            <span>
              BTC accrued (est.) <span className="ct-text-body font-medium">{accrued ?? "—"}</span>
            </span>
            {subscribedAt ? (
              <span>
                Subscribed <span className="ct-text-body font-medium">{subscribedAt}</span>
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-[var(--ct-space-2)]">
          <span
            className={cn(
              "rounded-full border px-[var(--ct-space-3)] py-[var(--ct-space-1)] body-xs font-medium capitalize",
              value.status === "active"
                ? "border-[var(--ct-border-accent)] text-[var(--ct-accent)]"
                : "border-[var(--ct-border-soft)] ct-text-muted",
            )}
          >
            {value.status ?? "unknown"}
          </span>
          <Link
            href="/my-vaults"
            className="body-xs ct-link-accent whitespace-nowrap"
          >
            View vault details →
          </Link>
        </div>
      </div>
    </Card>
  );
}
