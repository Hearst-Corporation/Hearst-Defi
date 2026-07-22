import { HcCompositionRing } from "@/components/dataviz/his";
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
    <Series1DashboardCard variant="secondary" className={className}>
      <Series1DashboardCardHeader title="Pocket allocation" />
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-[var(--ct-space-6)] py-[var(--ct-space-5)]">
        <HcCompositionRing
          segments={pockets.map((p) => ({
            label: p.id === "B1" ? `${p.id} · ${p.label}` : `${p.id} · ${p.label.replace("Reserve", "Res.")}`,
            value: p.value,
          }))}
          palette="accent"
          size={180}
          centerLabel={policyNotice ? "Policy target" : "Measured"}
          centerValue="40/27/33"
          bars
          aria-label="Series 1 allocation across the three pockets"
        />
      </div>
      {policyNotice ? (
        <div className={cn(surfaceNoticeWell, "px-[var(--ct-space-5)] py-[var(--ct-space-3)]")}>
          <Series1DataState motive="Configured policy split" detail={policyNotice} />
        </div>
      ) : null}
    </Series1DashboardCard>
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
