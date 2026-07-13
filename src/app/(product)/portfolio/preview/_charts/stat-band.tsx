/**
 * StatBand — edge-to-edge, borderless stat rail (Application UI V4 `stats/05` idiom).
 *
 * "Numbers are the graphics": each cell is a big tabular value + optional delta chip + a provenance/
 * asset dot. Cells are separated by 1px hairlines (gap-px on the border-soft bg), zero per-cell chrome.
 * Values render in accent green via the admin KPI class `.ct-bento-metric--accent` (same recipe as the
 * admin console KPI strips). The genuinely-Live cell (hashprice) additionally keeps the heartbeat pulse
 * dot as its distinguisher. `valueTone="btc"` keeps the number itself neutral/white and moves the
 * Bitcoin identity (--ct-cat-btc amber) onto the affix/dot only — a solid-amber figure would read as a
 * status/warning, not an asset. `hero` lifts a cell's value to the DS hero-number tier (`.ct-text-hero-tier`,
 * --ct-text-hero 40px — the global counterpart of admin's `.ds-hero-figure__value`). Token-only; reads
 * --ct-* (changes none). Server component.
 */
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import { ASSET_COLOR, type AssetKind } from "../_data/brand";

export interface StatCell {
  label: string;
  value: string;
  /** Signed delta chip, already formatted (e.g. "+6.3%"). */
  delta?: {
    text: string;
    tone: "up" | "down" | "flat";
    /** Strong emphasis for hero KPI deltas (larger text). */
    emphasis?: "normal" | "strong";
    /** Force accent green regardless of tone mapping. */
    forceAccent?: boolean;
  };
  provenance: Provenance;
  /**
   * Accent (green), neutral (white/strong body), or "btc" value text. "btc" keeps
   * the BIG NUMBER neutral/white — a solid-amber figure reads as a status/warning,
   * not an asset identity — and pushes the Bitcoin identity (--ct-cat-btc amber)
   * onto the unit/affix + identity dot only.
   */
  valueTone?: "accent" | "neutral" | "btc";
  /** Genuinely Live → accent value + heartbeat dot (reserved, honest). */
  live?: boolean;
  /**
   * Optional asset identity. When set on a non-Live cell, the provenance strip
   * dot is replaced by a small asset-coloured identity dot (Hearst green /
   * Bitcoin orange / USDC blue). Ignored on the Live cell (keeps its pulse).
   */
  asset?: AssetKind;
  /** Unit/affix text rendered after the value (e.g. "BTC"). Colour follows valueTone. */
  affix?: string;
  /** Render the value at the DS hero-number tier (--ct-text-hero, 40px) instead of the normal strip size. */
  hero?: boolean;
}

// No red anywhere on the platform: positive/negative deltas read neutral graphite.
const DELTA_COLOR: Record<"up" | "down" | "flat", string> = {
  up: "var(--ct-text-body)",
  down: "var(--ct-text-muted)",
  flat: "var(--ct-text-muted)",
};

/**
 * A value that carries no real magnitude — "$0", "$0.00", "0%", "—". Accent green
 * is reserved for genuine, non-zero figures (and the Live pulse); a zero rendered
 * green reads as an acquired gain (a $0 Accrued in green is a false positive). So
 * a zero/placeholder value falls back to the neutral strong text colour.
 */
function isZeroValue(value: string): boolean {
  const stripped = value.replace(/[\s$,%+]/g, "");
  return stripped === "" || stripped === "—" || /^-?0(\.0+)?$/.test(stripped);
}

export function StatBand({
  items,
  className,
}: {
  items: readonly StatCell[];
  className?: string;
}) {
  // Container queries (not viewport): the grid reacts to the real width of the
  // `product-doc` container (src/app/doc-flow.css), so it drops columns when the
  // Assistant rail opens/expands and squeezes the centre — instead of relying on
  // the window width and getting crushed. Each cell needs ~13rem to read cleanly.
  const cols =
    items.length >= 4
      ? "@[34rem]:grid-cols-2 @[52rem]:grid-cols-4"
      : items.length === 3
        ? "@[26rem]:grid-cols-3"
        : "@[26rem]:grid-cols-2";
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-px bg-(--ct-border-soft)",
        cols,
        className,
      )}
    >
      {items.map((it) => (
        <div key={it.label} className="flex min-w-0 flex-col items-center gap-2 bg-surface-card px-5 py-6 text-center">
          <div className="flex items-center justify-center gap-1.5">
            {it.live ? (
              <span
                aria-hidden="true"
                className="hyv-pulse inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "var(--ct-accent)", color: "var(--ct-accent)" }}
              />
            ) : it.asset ? (
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: ASSET_COLOR[it.asset] }}
              />
            ) : it.valueTone === "btc" ? (
              // BTC identity dot — amber, reserved for the affix/dot only (never the number).
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "var(--ct-cat-btc)" }}
              />
            ) : (
              <ProvenanceBadge kind={it.provenance} variant="strip" />
            )}
            <span className="ct-bento-label min-w-0 truncate">{it.label}</span>
          </div>
          <div className="flex items-baseline justify-center gap-2">
            <span
              className={cn(
                "ct-bento-metric tabular-nums",
                it.hero && "ct-text-hero-tier",
                // Accent green only for real, non-zero values; zeros and BTC-toned
                // cells (identity lives in the affix/dot, never the number) read neutral.
                isZeroValue(it.value) || it.valueTone === "neutral" || it.valueTone === "btc"
                  ? "ct-text-strong"
                  : "ct-bento-metric--accent",
              )}
            >
              {it.value}
            </span>
            {it.affix ? (
              <span
                className={cn(
                  "font-medium",
                  it.valueTone === "btc" ? "ct-text-cat-btc" : "ct-text-muted",
                )}
              >
                {it.affix}
              </span>
            ) : null}
            {it.delta ? (
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  it.delta.emphasis === "strong"
                    ? "text-(length:--ct-text-sm)"
                    : "text-(length:--ct-text-nano)",
                )}
                style={{
                  color: it.delta.forceAccent
                    ? "var(--ct-accent)"
                    : DELTA_COLOR[it.delta.tone],
                }}
              >
                {it.delta.text}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
