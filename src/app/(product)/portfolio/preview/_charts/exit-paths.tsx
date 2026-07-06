/**
 * ExitPaths — the 3 terminal vault outcomes on ONE shared capital axis anchored at deposit ×1.00.
 *
 * Take-profit is the single PRECISE, hard-rule outcome (deposit ×1.24 = +24%) → a solid accent bar
 * that reaches the +24% tick. Glide-path (matured ≥ deposit) and Recovery (matured < deposit,
 * bounded best-effort) are drawn as DIRECTIONAL FADED bands, never solid precise bars — the fade is
 * the honesty signal (same philosophy as the projection fan): no fabricated figure is implied. No red
 * anywhere — the downside/recovery band reads neutral graphite. Pure CSS, token-only. Server component.
 */
export type ExitKind = "take-profit" | "glide" | "recovery";

export interface ExitPathRow {
  label: string;
  mechanism: string;
  outcome: string;
  kind: ExitKind;
}

// Axis in gain-% around the deposit baseline (0 = ×1.00). Left region (downside) is intentionally
// UNLABELED — only the two honest anchors get ticks: deposit ×1.00 and the +24% take-profit rule.
const DOMAIN_MIN = -14;
const DOMAIN_MAX = 24;
const SPAN = DOMAIN_MAX - DOMAIN_MIN;
const xPct = (v: number): number => ((v - DOMAIN_MIN) / SPAN) * 100;
const DEPOSIT_PCT = xPct(0);

// The outcome-value column is FIXED (not `auto`) so every row AND the axis row share the exact same
// three-column geometry. That makes the middle track identical in width everywhere — which is what
// lets the ×1.00 anchor (and the take-profit right edge) land on the same x in all three rows and
// directly under the axis tick. `minmax(0,1fr)` keeps that track from being widened by intrinsic content.
const OUTCOME_COL = 76; // px — kept in sync with the outcome span min-width below.
const GRID_COLS = `clamp(88px,24%,132px) minmax(0,1fr) ${OUTCOME_COL}px`;

/** Per-kind band geometry + colour. Positions are % on the shared axis. */
const BAND: Record<ExitKind, { left: number; width: number; background: string; text: string }> = {
  "take-profit": {
    left: DEPOSIT_PCT,
    width: xPct(DOMAIN_MAX) - DEPOSIT_PCT,
    background: "var(--ct-accent)",
    text: "var(--ct-accent)",
  },
  glide: {
    left: DEPOSIT_PCT,
    width: xPct(13) - DEPOSIT_PCT,
    // open-ended "≥ deposit": start solid-ish at the baseline, fade rightward (upside not a point).
    background:
      "linear-gradient(to right, color-mix(in srgb, var(--ct-accent) 42%, transparent), transparent)",
    text: "var(--ct-text-body)",
  },
  recovery: {
    left: xPct(-11),
    width: DEPOSIT_PCT - xPct(-11),
    // bounded best-effort downside: grey, fading toward the left (never red, never precise).
    background:
      "linear-gradient(to left, color-mix(in srgb, var(--ct-text-muted) 55%, transparent), transparent)",
    text: "var(--ct-text-muted)",
  },
};

export function ExitPaths({ paths }: { paths: readonly ExitPathRow[] }) {
  return (
    <div className="flex flex-1 flex-col justify-between gap-4 p-5">
      <div className="flex flex-col gap-3">
        {paths.map((p) => {
          const band = BAND[p.kind];
          return (
            <div
              key={p.label}
              className="grid items-center gap-3"
              style={{ gridTemplateColumns: GRID_COLS }}
            >
              <div className="flex min-w-0 flex-col">
                <span className="ct-metric-value truncate text-[length:var(--ct-text-sm)] leading-tight">
                  {p.label}
                </span>
                <span className="ct-metric-caption line-clamp-1 text-[length:var(--ct-text-nano)] leading-snug">
                  {p.mechanism}
                </span>
              </div>

              <div
                className="relative h-3 w-full overflow-hidden rounded-full"
                style={{ background: "var(--ct-surface-inset)" }}
                role="img"
                aria-label={`${p.label}: ${p.outcome}`}
              >
                {/* outcome band */}
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 rounded-full"
                  style={{ left: `${band.left}%`, width: `${band.width}%`, background: band.background }}
                />
                {/* deposit ×1.00 anchor — drawn on top of the band so the shared reference stays a
                    crisp hairline in every row (it coincides with each band's baseline edge). */}
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 w-px"
                  style={{ left: `${DEPOSIT_PCT}%`, background: "var(--ct-border-strong)" }}
                />
              </div>

              <span
                className="whitespace-nowrap text-right text-[length:var(--ct-text-xs)] font-semibold tabular-nums"
                style={{ minWidth: OUTCOME_COL, color: band.text }}
              >
                {p.outcome}
              </span>
            </div>
          );
        })}
      </div>

      {/* axis ticks — only the two honest anchors */}
      <div className="grid gap-3" style={{ gridTemplateColumns: GRID_COLS }}>
        <span aria-hidden="true" />
        <div className="relative h-3 text-[length:var(--ct-text-nano)] ct-text-muted">
          <span className="absolute -translate-x-1/2" style={{ left: `${DEPOSIT_PCT}%` }}>
            deposit ×1.00
          </span>
          <span className="absolute right-0">+24%</span>
        </div>
        <span aria-hidden="true" style={{ minWidth: OUTCOME_COL }} />
      </div>
    </div>
  );
}
