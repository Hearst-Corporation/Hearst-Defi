// Series1CapitalArchitecture — how subscribed capital is governed.
//
// DS grammar (design-system.html §06/§10): ONE surfaceRaised per block, with
// the plot on a sunken well inside it. The previous version stacked
// Series1DashboardCard → Series1DashboardInset → the reserve-cockpit module's
// own `ReserveBlockFrame` (itself a framed card) = three frames.
//
// Fix: compose the DS PRIMITIVES directly — `HcCompositionRing` for the ring,
// a hairline gauge list for the split — instead of the module wrappers that
// draw their own card. The primitives are the shared layer the canon marks
// KEEP DS PRIMITIVE; only the redundant chrome is dropped.
//
// Honesty: when the live `strategies()` read is unavailable, the POLICY target
// (40/27/33, VAULT_SPEC_V2.1 §6) is a spec constant and may be shown — but
// only ever LABELLED as the configured target, never as a measurement.

import { HcCompositionRing } from "@/components/dataviz/his";

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

/** The capital route, as the DS renders a process: numbered steps on a rail. */
const FLOW_STEPS: readonly { label: string; detail: string }[] = [
  { label: "USDC subscription", detail: "deposit(assets, receiver) mints shares" },
  { label: "B1 / B2 / B3 allocation", detail: "Assets route to the policy split on deposit" },
  { label: "BTC reserve ledger", detail: "Mining production credits the reserve" },
  { label: "Delivery at maturity", detail: "The accumulated reserve is delivered in BTC" },
];

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
  return (
    <div
      className={
        className ??
        "grid min-w-0 grid-cols-1 gap-[var(--ct-space-4)] xl:grid-cols-[1fr_1fr]"
      }
    >
      <Series1DashboardCard>
        <Series1DashboardCardHeader title="Pocket allocation" />
        <div className="flex flex-1 flex-col items-center justify-center px-[var(--ct-space-6)] py-[var(--ct-space-5)]">
          <HcCompositionRing
            segments={pockets.map((p) => ({
              label: `${p.id} · ${p.label}`,
              value: p.value,
            }))}
            palette="categorical"
            size={180}
            centerLabel={policyNotice ? "Policy target" : "Measured"}
            centerValue="40/27/33"
            bars
            aria-label="Series 1 allocation across the three pockets"
          />
        </div>
        {policyNotice ? (
          <div className="border-t border-[var(--ct-border-soft)] px-[var(--ct-space-5)] py-[var(--ct-space-3)]">
            <Series1DataState motive="Configured policy split" detail={policyNotice} />
          </div>
        ) : null}
      </Series1DashboardCard>

      <Series1DashboardCard>
        <Series1DashboardCardHeader title="Capital flow" />
        <ol className="m-0 flex list-none flex-col p-[var(--ct-space-5)]">
          {FLOW_STEPS.map((step, index) => {
            const isLast = index === FLOW_STEPS.length - 1;
            return (
              <li key={step.label} className="flex gap-[var(--ct-space-4)]">
                {/* Rail: numbered plate + connector. The accent marks the
                    terminal step (delivery) — one signal, not a filled column. */}
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
    </div>
  );
}
