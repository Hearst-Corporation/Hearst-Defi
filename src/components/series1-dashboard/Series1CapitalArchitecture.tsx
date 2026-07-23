import { HcStackedBar } from "@/components/dataviz/his";
import { cn } from "@/lib/cn";
import { surfaceNoticeWell } from "@/lib/ui/surface-classes";

import {
  Series1DashboardCard,
  Series1DashboardCardHeader,
} from "./Series1DashboardSection";
import { Series1DataState } from "./Series1DataState";

export interface Series1Pocket {
  id: "B1" | "B2" | "B3";
  label: string;
  /** Share of the total, in percent. */
  value: number;
}

/** The Series 1 policy split — a SPEC CONSTANT (VAULT_SPEC_V2.1 §6). */
const POLICY_TARGET: readonly Series1Pocket[] = [
  { id: "B1", label: "Mining Power", value: 40 },
  { id: "B2", label: "BTC Pouch", value: 27 },
  { id: "B3", label: "Reserve USDC", value: 33 },
];

/**
 * Target-vs-on-chain stacked pair — the instrument the chart-library selection
 * mandates for allocation (§4.3): "stacked pair target-vs-on-chain (le gap EST
 * l'information), pas un donut". Two bars share one categorical palette; the
 * eye compares the seams. When the live read is unavailable the second row
 * states so honestly — no fabricated bar.
 */
export function Series1CapitalArchitecture({
  pockets,
  /** Non-null when the allocation shown is the policy target, not a measurement. */
  policyNotice,
  className,
}: {
  pockets: readonly Series1Pocket[];
  policyNotice: string | null;
  className?: string;
}) {
  const measured = policyNotice ? null : pockets;

  return (
    <Series1DashboardCard variant="secondary" className={className}>
      <Series1DashboardCardHeader
        title="Pocket allocation"
        caption="Policy target against the on-chain split — the gap is the information"
      />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-[var(--ct-space-5)] px-[var(--ct-space-6)] py-[var(--ct-space-5)]">
        <AllocationBarRow
          label="Policy target"
          sub="VAULT_SPEC v2.1 §6 — configured, not a measurement"
          pockets={POLICY_TARGET}
          showLegend
        />
        {measured ? (
          <AllocationBarRow
            label="On-chain"
            sub="strategies() — measured on the contract"
            pockets={measured}
          />
        ) : (
          <div>
            <p
              className="m-0 font-medium uppercase tracking-[0.12em] text-[var(--ct-text-faint)]"
              style={{ fontSize: "var(--ct-text-nano)" }}
            >
              On-chain
            </p>
            <div className="mt-[var(--ct-space-2)] h-[10px] rounded-[var(--ct-radius-full)] ring-1 ring-inset ring-[var(--ct-border-soft)]" />
          </div>
        )}
      </div>
      {policyNotice ? (
        <div className={cn(surfaceNoticeWell, "px-[var(--ct-space-5)] py-[var(--ct-space-3)]")}>
          <Series1DataState motive="Configured policy split" detail={policyNotice} />
        </div>
      ) : null}
    </Series1DashboardCard>
  );
}

/** One labelled allocation bar of the pair. */
function AllocationBarRow({
  label,
  sub,
  pockets,
  showLegend = false,
}: {
  label: string;
  sub: string;
  pockets: readonly Series1Pocket[];
  showLegend?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-[var(--ct-space-4)]">
        <p
          className="m-0 font-medium uppercase tracking-[0.12em] text-[var(--ct-text-muted)]"
          style={{ fontSize: "var(--ct-text-nano)" }}
        >
          {label}
        </p>
        <p
          className="m-0 truncate text-[var(--ct-text-faint)]"
          style={{ fontSize: "var(--ct-text-nano)" }}
        >
          {sub}
        </p>
      </div>
      <HcStackedBar
        className="mt-[var(--ct-space-2)]"
        segments={pockets.map((p) => ({ label: `${p.id} · ${p.label}`, value: p.value }))}
        palette="categorical"
        height={12}
        showLegend={showLegend}
        aria-label={`${label}: allocation across the three Series 1 pockets`}
      />
    </div>
  );
}

/** The capital route, as the DS renders a process: numbered steps on a rail. */
const FLOW_STEPS: readonly { label: string; detail: string }[] = [
  { label: "USDC subscription", detail: "deposit(assets, receiver) mints shares" },
  { label: "B1 / B2 / B3 allocation", detail: "Assets route to the policy split on deposit" },
  { label: "BTC reserve ledger", detail: "Mining production credits the reserve" },
  { label: "Delivery at maturity", detail: "The accumulated reserve is delivered in BTC" },
];

/** The capital route card, moved out of the hero row into the registry section. */
export function Series1CapitalFlow({ className }: { className?: string }) {
  return (
    <Series1DashboardCard variant="quiet" className={className}>
      <Series1DashboardCardHeader title="Capital flow" />
      <ol className="m-0 flex flex-1 list-none flex-col p-[var(--ct-space-5)]">
        {FLOW_STEPS.map((step, index) => {
          const isLast = index === FLOW_STEPS.length - 1;
          return (
            <li key={step.label} className="flex gap-[var(--ct-space-4)]">
              <div className="flex flex-col items-center">
                <span
                  className={
                    isLast
                      ? "flex size-7 shrink-0 items-center justify-center rounded-md font-semibold tabular-nums text-[var(--ct-accent-strong)] ring-1 ring-[var(--ct-border-accent)]"
                      : "flex size-7 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--ct-bg-deep)_55%,var(--ct-surface-page))] font-semibold tabular-nums text-[var(--ct-text-muted)]"
                  }
                  style={{ fontSize: "var(--ct-text-nano)" }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                {!isLast ? (
                  <span className="my-1 w-px flex-1 bg-[var(--ct-border-soft)]" />
                ) : null}
              </div>
              <div className={isLast ? "pb-0" : "pb-[var(--ct-space-5)]"}>
                <p
                  className="m-0 pt-1 font-medium text-[var(--ct-text-strong)]"
                  style={{ fontSize: "var(--ct-text-2xs)" }}
                >
                  {step.label}
                </p>
                <p
                  className="m-0 mt-[var(--ct-space-1)] leading-relaxed text-[var(--ct-text-faint)]"
                  style={{ fontSize: "var(--ct-text-nano)" }}
                >
                  {step.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </Series1DashboardCard>
  );
}
