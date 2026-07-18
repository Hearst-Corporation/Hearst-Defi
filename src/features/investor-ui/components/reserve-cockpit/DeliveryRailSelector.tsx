// src/features/investor-ui/components/reserve-cockpit/DeliveryRailSelector.tsx
//
// DeliveryRailSelector — how accumulated BTC is delivered at maturity. Read-only
// by design: it displays the available delivery rails and which one (if any) is
// configured for this position. It performs NO network action and takes no
// selection callback — configuring a delivery rail is a custodial decision that
// lives behind a separate, human-gated flow, never triggered from a viz block
// (non-negotiable #4 — no custodial action from the cockpit surface).
//
// HONEST: nothing configured → DataNotConfigured; unconfigured rails are shown as
// available options, never as "selected".

import { HcSourceBadge } from "@/components/dataviz/his";
import type { HcSourceStatus } from "@/components/dataviz/his";

import { ReserveBlockFrame } from "./block-frame";
import { DataNotConfigured } from "../states/data-states";

export interface DeliveryRail {
  readonly id: string;
  readonly label: string;
  /** Short description of the rail, e.g. "Native BTC to a whitelisted address". */
  readonly description: string;
  /** True if this rail is available to configure (vs coming later). */
  readonly available: boolean;
}

export interface DeliveryRailSelectorData {
  readonly rails: readonly DeliveryRail[];
  /** The id of the configured rail, or null when none is set yet. */
  readonly configuredRailId: string | null;
}

export interface DeliveryRailSelectorProps {
  data: DeliveryRailSelectorData | null;
  source?: HcSourceStatus;
  className?: string;
}

export function DeliveryRailSelector({
  data,
  source = "configured",
  className,
}: DeliveryRailSelectorProps) {
  if (!data || data.rails.length === 0) {
    return (
      <ReserveBlockFrame title="Delivery Rail" source="configured" className={className}>
        <DataNotConfigured
          label="Delivery rail"
          detail="No BTC delivery rail is configured for this position yet. Delivery is set up before maturity through a separate, reviewed flow."
        />
      </ReserveBlockFrame>
    );
  }

  const configured = data.configuredRailId
    ? data.rails.find((r) => r.id === data.configuredRailId) ?? null
    : null;

  return (
    <ReserveBlockFrame
      title="Delivery Rail"
      source={source}
      subtitle="How accumulated BTC is delivered at maturity"
      headerRight={
        <HcSourceBadge
          status={configured ? "configured" : "estimated"}
          title={configured ? "A delivery rail is configured" : "No rail configured yet"}
        />
      }
      className={className}
      footnote="Read-only. Configuring or changing the delivery rail is a reviewed, human-gated action handled outside this view — it is never triggered from here."
    >
      <ul className="flex flex-col gap-[var(--ct-space-2)]">
        {data.rails.map((rail) => {
          const isConfigured = configured?.id === rail.id;
          const borderColor = isConfigured
            ? "var(--ct-border-accent)"
            : "var(--ct-border-soft)";
          return (
            <li
              key={rail.id}
              aria-current={isConfigured ? "true" : undefined}
              className="flex items-start gap-[var(--ct-space-3)] rounded-[var(--ct-radius-lg)] border bg-[var(--ct-surface-inset)] px-[var(--ct-space-3)] py-[var(--ct-space-3)]"
              style={{ borderColor }}
            >
              <span
                aria-hidden="true"
                className="mt-[3px] shrink-0"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: isConfigured ? "var(--ct-accent)" : "transparent",
                  border: isConfigured ? "none" : "1.5px solid var(--ct-border-soft)",
                  boxShadow: isConfigured ? "0 0 6px var(--ct-accent)" : "none",
                }}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-[var(--ct-space-1)]">
                <div className="flex items-center gap-[var(--ct-space-2)]">
                  <span
                    style={{
                      fontSize: "var(--ct-text-2xs)",
                      fontWeight: 700,
                      color: "var(--ct-text-primary)",
                    }}
                  >
                    {rail.label}
                  </span>
                  {isConfigured ? (
                    <StatusPill tone="accent" label="Configured" />
                  ) : rail.available ? (
                    <StatusPill tone="muted" label="Available" />
                  ) : (
                    <StatusPill tone="muted" label="Coming later" />
                  )}
                </div>
                <span
                  style={{ fontSize: "var(--ct-text-nano)", color: "var(--ct-text-muted)" }}
                >
                  {rail.description}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </ReserveBlockFrame>
  );
}

function StatusPill({ tone, label }: { tone: "accent" | "muted"; label: string }) {
  const color = tone === "accent" ? "var(--ct-accent-strong)" : "var(--ct-text-muted)";
  const border = tone === "accent" ? "var(--ct-border-accent)" : "var(--ct-border-soft)";
  return (
    <span
      className="rounded-[var(--ct-radius-full)] border px-[var(--ct-space-2)]"
      style={{
        borderColor: border,
        fontSize: "var(--ct-text-nano)",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color,
      }}
    >
      {label}
    </span>
  );
}
