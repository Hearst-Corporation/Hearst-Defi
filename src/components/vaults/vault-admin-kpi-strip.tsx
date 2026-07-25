import { TargetRange } from "@/components/catalyst/target-range";
import { Progress } from "@/components/catalyst/progress";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { formatUsdFull } from "@/lib/vaults/product-display";
import { bpsToPercent, type VaultKpiFacts } from "@/lib/vaults/vault-detail-facts";

interface VaultAdminKpiStripProps {
  facts: VaultKpiFacts;
  /** Vault lifecycle status — the AUM tile is ALWAYS rendered (real principal
   *  can exist outside `live`); a non-live status is stated on the tile
   *  instead of silently hiding the money. */
  vaultStatus: string;
}

export function VaultAdminKpiStrip({
  facts,
  vaultStatus,
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
      <div className="grid grid-cols-2 gap-px bg-[var(--ct-border-soft)] lg:grid-cols-4">
        {/* Estimated accumulation — v2 mining note: BTC accumulated over the
            term, not a paid rate. Range format kept (non-negotiable #1). */}
        <div className="bg-surface-card p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 min-h-5">
            <span className="ct-bento-label">
              Est. accumulation range
            </span>
            <ProvenanceBadge kind="estimated" />
          </div>
          <div className="text-[length:var(--ct-text-xl-fixed)] font-medium leading-none tracking-tight tabular-nums">
            <TargetRange
              low={facts.apyLow}
              high={facts.apyHigh}
              precision={1}
              className="font-medium text-[var(--ct-accent)]"
            />
          </div>
          <p className="text-[length:var(--ct-text-deci)] text-[var(--ct-text-faint)] tracking-wide">
            BTC accumulated over the term — not a paid rate, not guaranteed
          </p>
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
          <p className="text-[length:var(--ct-text-deci)] text-[var(--ct-text-faint)] tracking-wide">Contractual soft lock-up</p>
        </div>

        {/* AUM — always visible: real principal can exist before/after `live`.
            Badge = `estimated`, consistent with the chain panel's "Database
            aggregate" row rendered a few lines below (a Prisma sum is never
            `live` data). */}
        <div className="bg-surface-card p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 min-h-5">
            <span className="ct-bento-label">
              AUM
            </span>
            <ProvenanceBadge kind="estimated" />
          </div>
          <span className="text-[length:var(--ct-text-xl-fixed)] font-medium text-[var(--ct-text-strong)] leading-none tracking-tight tabular-nums">
            {formatUsdFull(facts.currentAumUsdc)}
          </span>
          <div className="mt-1">
            <Progress value={aumPct} label="AUM vs capacity" />
          </div>
          <p className="text-[length:var(--ct-text-deci)] text-[var(--ct-text-faint)] tracking-wide">
            / {formatUsdFull(facts.capacityUsdc)} capacity · database aggregate
          </p>
          {vaultStatus !== "live" ? (
            <p className="text-[length:var(--ct-text-deci)] text-[var(--ct-text-faint)] tracking-wide">
              Vault status: {vaultStatus} — recorded principal, not a live vault
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
