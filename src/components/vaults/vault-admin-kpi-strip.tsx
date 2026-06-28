import { ApyRange } from "@/components/ui/apy-range";
import { Progress } from "@/components/ui/progress";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { formatUsdFull } from "@/lib/vaults/product-display";
import { bpsToPercent, type VaultKpiFacts } from "@/lib/vaults/vault-detail-facts";
import { cn } from "@/lib/cn";

interface VaultAdminKpiStripProps {
  facts: VaultKpiFacts;
  showAumCard: boolean;
}

export function VaultAdminKpiStrip({
  facts,
  showAumCard,
}: VaultAdminKpiStripProps) {
  const aumPct =
    facts.capacityUsdc > 0
      ? (facts.currentAumUsdc / facts.capacityUsdc) * 100
      : 0;

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4 mb-8",
        showAumCard ? "lg:grid-cols-4" : "lg:grid-cols-3",
      )}
    >
      {/* Target APY */}
      <div className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm p-5 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="ct-bento-label">
            Target APY
          </span>
          <ProvenanceBadge kind="estimated" />
        </div>
        <div className="text-[18px] font-medium leading-none tracking-tight tabular-nums">
          <ApyRange
            low={facts.apyLow}
            high={facts.apyHigh}
            precision={1}
            className="font-medium text-[var(--ct-accent)]"
          />
        </div>
        <p className="text-[10px] text-[var(--ct-text-faint)] tracking-wide">Not guaranteed — estimated</p>
      </div>

      {/* Fees */}
      <div className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm p-5 flex flex-col gap-2">
        <span className="ct-bento-label">
          Fees
        </span>
        <span className="text-[18px] font-medium text-white leading-none tracking-tight tabular-nums">
          {bpsToPercent(facts.mgmtFeeBps)}% / {bpsToPercent(facts.perfFeeBps)}%
        </span>
        <p className="text-[10px] text-[var(--ct-text-faint)] tracking-wide">Mgmt / Perf</p>
      </div>

      {/* Lock-up */}
      <div className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm p-5 flex flex-col gap-2">
        <span className="ct-bento-label">
          Lock-up
        </span>
        <span className="text-[18px] font-medium text-white leading-none tracking-tight tabular-nums">
          {facts.softLockupDays}d
        </span>
        <p className="text-[10px] text-[var(--ct-text-faint)] tracking-wide">Soft lock-up</p>
      </div>

      {/* AUM */}
      {showAumCard ? (
        <div className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="ct-bento-label">
              AUM
            </span>
            <ProvenanceBadge
              kind={facts.currentAumUsdc > 0 ? "live" : "estimated"}
            />
          </div>
          <span className="text-[18px] font-medium text-white leading-none tracking-tight tabular-nums">
            {formatUsdFull(facts.currentAumUsdc)}
          </span>
          <div className="mt-1">
            <Progress value={aumPct} label="AUM vs capacity" />
          </div>
          <p className="text-[10px] text-[var(--ct-text-faint)] tracking-wide">
            / {formatUsdFull(facts.capacityUsdc)} capacity
          </p>
        </div>
      ) : null}
    </div>
  );
}
