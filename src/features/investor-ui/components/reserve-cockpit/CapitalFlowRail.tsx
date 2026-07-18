// src/features/investor-ui/components/reserve-cockpit/CapitalFlowRail.tsx
//
// CapitalFlowRail — the Series 1 narrative as a horizontal, tokenised rail:
//   USDC deposit → B1 Mining Power (40) / B2 BTC Pouch (27) / B3 Reserve USDC (33)
//              → BTC Reserve Ledger → Delivery at maturity.
//
// Pure SVG + HTML overlay, token-only. The three pockets are sized to their
// share of the deposit so the rail reads the 40/27/33 split visually. HONEST:
// null input → DataUnavailable, never a fabricated split.

import { HcSourceBadge } from "@/components/dataviz/his";
import type { HcSourceStatus } from "@/components/dataviz/his";

import { ReserveBlockFrame } from "./block-frame";
import { DataUnavailable } from "../states/data-states";

export interface CapitalFlowPocket {
  /** Pocket key — B1 / B2 / B3. */
  readonly id: "B1" | "B2" | "B3";
  readonly label: string;
  /** Target allocation weight (e.g. 40 / 27 / 33). */
  readonly weightPct: number;
}

export interface CapitalFlowRailData {
  /** Deposit currency label for the source node, e.g. "USDC". */
  readonly depositLabel: string;
  /** Optional formatted deposit amount (already formatted server-side). */
  readonly depositAmount?: string;
  readonly pockets: readonly CapitalFlowPocket[];
  /** Label for the accumulation node, e.g. "BTC Reserve Ledger". */
  readonly ledgerLabel: string;
  /** Label for the terminal node, e.g. "Delivery at maturity". */
  readonly deliveryLabel: string;
}

export interface CapitalFlowRailProps {
  data: CapitalFlowRailData | null;
  source?: HcSourceStatus;
  className?: string;
}

const POCKET_COLOR: Record<CapitalFlowPocket["id"], string> = {
  B1: "var(--ct-cat-mining)",
  B2: "var(--ct-cat-btc)",
  B3: "var(--ct-cat-usdc)",
};

export function CapitalFlowRail({
  data,
  source = "attested",
  className,
}: CapitalFlowRailProps) {
  if (!data || data.pockets.length === 0) {
    return (
      <ReserveBlockFrame title="Capital Flow" source={source} className={className}>
        <DataUnavailable
          label="Capital flow"
          detail="No allocation split has resolved. Nothing is being split in its place."
        />
      </ReserveBlockFrame>
    );
  }

  const weightTotal = data.pockets.reduce((s, p) => s + Math.max(0, p.weightPct), 0) || 1;

  return (
    <ReserveBlockFrame
      title="Capital Flow"
      source={source}
      subtitle={`${data.depositLabel} → 3 pockets → ${data.ledgerLabel} → ${data.deliveryLabel}`}
      className={className}
      footnote="Allocation is a target policy split, not a guaranteed outcome. BTC is accumulated over the term and delivered at maturity — there is no periodic cash distribution."
    >
      <div className="flex flex-col gap-[var(--ct-space-4)]">
        {/* Source → pockets → ledger → delivery, as labelled nodes on a rail. */}
        <div className="flex items-stretch gap-[var(--ct-space-2)]">
          <RailNode
            title={data.depositLabel}
            value={data.depositAmount}
            tone="neutral"
          />
          <RailArrow />
          <div className="flex min-w-0 flex-1 flex-col gap-[var(--ct-space-2)]">
            {data.pockets.map((p) => {
              const pct = (Math.max(0, p.weightPct) / weightTotal) * 100;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-[var(--ct-space-2)] rounded-[var(--ct-radius-lg)] border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] px-[var(--ct-space-3)] py-[var(--ct-space-2)]"
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "var(--ct-radius-xs)",
                      background: POCKET_COLOR[p.id],
                      flexShrink: 0,
                    }}
                  />
                  <span
                    className="min-w-0 flex-1 truncate"
                    style={{ fontSize: "var(--ct-text-2xs)", color: "var(--ct-text-body)" }}
                  >
                    <span style={{ fontWeight: 700, color: "var(--ct-text-primary)" }}>
                      {p.id}
                    </span>{" "}
                    {p.label}
                  </span>
                  {/* Weight gauge — share of the deposit routed to this pocket. */}
                  <span
                    aria-hidden="true"
                    className="hidden sm:block"
                    style={{
                      width: 72,
                      height: 4,
                      borderRadius: "var(--ct-radius-full)",
                      background: "var(--ct-surface-card)",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        width: `${pct.toFixed(1)}%`,
                        height: "100%",
                        background: POCKET_COLOR[p.id],
                      }}
                    />
                  </span>
                  <span
                    style={{
                      width: 36,
                      textAlign: "right",
                      flexShrink: 0,
                      fontSize: "var(--ct-text-2xs)",
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 700,
                      color: "var(--ct-text-primary)",
                    }}
                  >
                    {pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
          <RailArrow />
          <RailNode title={data.ledgerLabel} tone="accent" />
          <RailArrow />
          <RailNode title={data.deliveryLabel} tone="accent" />
        </div>

        <div className="flex items-center gap-[var(--ct-space-2)]">
          <HcSourceBadge status={source} dotOnly title={`Capital flow source: ${source}`} />
          <span style={{ fontSize: "var(--ct-text-nano)", color: "var(--ct-text-faint)" }}>
            Pocket colours: mining · bitcoin · reserve USDC
          </span>
        </div>
      </div>
    </ReserveBlockFrame>
  );
}

function RailNode({
  title,
  value,
  tone,
}: {
  title: string;
  value?: string;
  tone: "neutral" | "accent";
}) {
  const border = tone === "accent" ? "var(--ct-border-accent)" : "var(--ct-border-soft)";
  const fg = tone === "accent" ? "var(--ct-accent-strong)" : "var(--ct-text-primary)";
  return (
    <div
      className="flex w-[92px] shrink-0 flex-col justify-center gap-[var(--ct-space-1)] rounded-[var(--ct-radius-lg)] border bg-[var(--ct-surface-inset)] px-[var(--ct-space-2)] py-[var(--ct-space-3)] text-center"
      style={{ borderColor: border }}
    >
      <span style={{ fontSize: "var(--ct-text-2xs)", fontWeight: 700, color: fg }}>{title}</span>
      {value ? (
        <span
          style={{
            fontSize: "var(--ct-text-nano)",
            fontVariantNumeric: "tabular-nums",
            color: "var(--ct-text-muted)",
          }}
        >
          {value}
        </span>
      ) : null}
    </div>
  );
}

function RailArrow() {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center self-center"
      style={{ color: "var(--ct-text-faint)", fontSize: "var(--ct-text-sm)" }}
    >
      →
    </span>
  );
}
