/**
 * PocketCards — the 3 vault pockets (B1/B2/B3) as asset-colored metric cards. Each card now carries
 * its OWN asset identity: a round asset logo (via <AssetBadge>) plus an allocation bar and accent
 * drawn from ASSET_COLOR — B1 Mining power = Hearst green, B2 wBTC = Bitcoin orange, B3 USDC = blue.
 * The logo IS the identity mark (no more square color chip). Token-only for Hearst; asset brand hues
 * for Bitcoin/USDC (no red — orange is asset identity, never danger). Server component.
 */
import { ASSET_COLOR, type AssetKind } from "../_data/brand";
import { AssetBadge } from "./asset-badge";

export interface PocketCard {
  label: string;
  valueUsdc: number;
  pct: number;
  role: string;
  asset: AssetKind;
}

export function PocketCards({
  pockets,
  format,
}: {
  pockets: readonly PocketCard[];
  format: (n: number) => string;
}) {
  return (
    <div className="grid h-full grid-cols-1 gap-px overflow-hidden rounded-xl bg-[var(--ct-border-soft)] sm:grid-cols-3">
      {pockets.map((p) => {
        const color = ASSET_COLOR[p.asset];
        return (
          <div key={p.label} className="flex min-w-0 flex-col gap-3 bg-surface-card p-4">
            <div className="flex items-center gap-1.5">
              <AssetBadge asset={p.asset} size={18} />
              <span className="ct-bento-label truncate">{p.label}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="ct-metric-value text-[length:var(--ct-text-2xl)] tabular-nums">{p.pct}%</span>
              <span className="ct-metric-caption tabular-nums">{format(p.valueUsdc)}</span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full"
              style={{ background: "var(--ct-surface-inset)" }}
            >
              <div className="h-full rounded-full" style={{ width: `${p.pct}%`, background: color }} />
            </div>
            <span className="ct-metric-caption mt-auto min-h-[2.6em] pt-1 text-[length:var(--ct-text-nano)] leading-snug line-clamp-2">{p.role}</span>
          </div>
        );
      })}
    </div>
  );
}
