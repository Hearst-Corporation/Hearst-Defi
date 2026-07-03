import { ApyRange } from "@/components/catalyst/apy-range";
import { Progress } from "@/components/catalyst/progress";
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
    // Welded canon card (governance proposal-meta pattern): ONE framed surface,
    // tiles separated by hairlines (gap-px on the border color) instead of
    // floating individually-framed mini-cards. Anti cage-in-cage.
    <section
      className="overflow-hidden rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)]"
      aria-label="Vault terms"
    >
      <div
        className={cn(
          "grid grid-cols-2 gap-px bg-[var(--ct-border-soft)]",
          showAumCard ? "lg:grid-cols-4" : "lg:grid-cols-3",
        )}
      >
        {/* Target APY */}
        <div className="bg-surface-card p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 min-h-5">
            <span className="ct-bento-label">
              Target APY
            </span>
            <ProvenanceBadge kind="estimated" />
          </div>
          <div className="text-[length:var(--ct-text-xl-fixed)] font-medium leading-none tracking-tight tabular-nums">
            <ApyRange
              low={facts.apyLow}
              high={facts.apyHigh}
              precision={1}
              className="font-medium text-[var(--ct-accent)]"
            />
          </div>
          <p className="text-[length:var(--ct-text-deci)] text-[var(--ct-text-faint)] tracking-wide">Not guaranteed — estimated</p>
        </div>

        {/* Fees */}
        <div className="bg-surface-card p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 min-h-5">
            <span className="ct-bento-label">
              Fees
            </span>
            <span />
          </div>
          <span className="text-[length:var(--ct-text-xl-fixed)] font-medium text-[var(--ct-text-strong)] leading-none tracking-tight tabular-nums">
            {bpsToPercent(facts.mgmtFeeBps)}% / {bpsToPercent(facts.perfFeeBps)}%
          </span>
          <p className="text-[length:var(--ct-text-deci)] text-[var(--ct-text-faint)] tracking-wide">Mgmt / Perf</p>
        </div>

        {/* Lock-up */}
        <div className="bg-surface-card p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 min-h-5">
            <span className="ct-bento-label">
              Lock-up
            </span>
            <span />
          </div>
          <span className="text-[length:var(--ct-text-xl-fixed)] font-medium text-[var(--ct-text-strong)] leading-none tracking-tight tabular-nums">
            {facts.softLockupDays}d
          </span>
          <p className="text-[length:var(--ct-text-deci)] text-[var(--ct-text-faint)] tracking-wide">Soft lock-up</p>
        </div>

        {/* AUM */}
        {showAumCard ? (
          <div className="bg-surface-card p-5 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 min-h-5">
              <span className="ct-bento-label">
                AUM
              </span>
              <ProvenanceBadge
                kind={facts.currentAumUsdc > 0 ? "live" : "estimated"}
              />
            </div>
            <span className="text-[length:var(--ct-text-xl-fixed)] font-medium text-[var(--ct-text-strong)] leading-none tracking-tight tabular-nums">
              {formatUsdFull(facts.currentAumUsdc)}
            </span>
            <div className="mt-1">
              <Progress value={aumPct} label="AUM vs capacity" />
            </div>
            <p className="text-[length:var(--ct-text-deci)] text-[var(--ct-text-faint)] tracking-wide">
              / {formatUsdFull(facts.capacityUsdc)} capacity
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
