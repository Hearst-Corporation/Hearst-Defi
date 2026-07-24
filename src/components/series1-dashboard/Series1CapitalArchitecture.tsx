import { Stepper } from "@/components/catalyst/stepper";
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
 * One labelled allocation bar of the target-vs-on-chain pair.
 *
 * The single source of truth for this row: it was copied verbatim into
 * Series1AllocationCockpit ("shared shape with Series1CapitalArchitecture").
 * Both callers now import THIS — one bar, one legend contract, one palette.
 */
export function AllocationBarRow({
  label,
  sub,
  pockets,
  showLegend = false,
  className,
}: {
  label: string;
  sub: string;
  pockets: readonly Series1Pocket[];
  showLegend?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
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

/**
 * The honest counterpart to a bar: a slot the on-chain read has not filled.
 * A hairline track, never a fabricated zero-value bar — the gap IS the signal.
 */
export function AllocationBarEmpty({ label }: { label: string }) {
  return (
    <div>
      <p
        className="m-0 font-medium uppercase tracking-[0.12em] text-[var(--ct-text-faint)]"
        style={{ fontSize: "var(--ct-text-nano)" }}
      >
        {label}
      </p>
      <div className="mt-[var(--ct-space-2)] h-[10px] rounded-[var(--ct-radius-full)] ring-1 ring-inset ring-[var(--ct-border-soft)]" />
    </div>
  );
}

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
          <AllocationBarEmpty label="On-chain" />
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

/** The capital route, as the DS renders a process: numbered steps on a rail. */
const FLOW_STEPS: readonly { label: string; detail: string }[] = [
  { label: "USDC subscription", detail: "deposit(assets, receiver) mints shares" },
  { label: "B1 / B2 / B3 allocation", detail: "Assets route to the policy split on deposit" },
  { label: "BTC reserve ledger", detail: "Mining production credits the reserve" },
  { label: "Delivery at maturity", detail: "The accumulated reserve is delivered in BTC" },
];

/** The capital route card, moved out of the hero row into the registry section. */
export function Series1CapitalFlow({ className }: { className?: string }) {
  // DS convergence: the numbered rail now delegates to the Catalyst `Stepper`
  // primitive (size="xs"). The last step is the accent (ringed) node — the reserve
  // delivery is the destination — every earlier step is the quiet node. Render
  // unchanged; the outer <ol>'s layout classes (m-0 flex-1 list-none padding) pass
  // through Stepper's className.
  return (
    <Series1DashboardCard variant="quiet" className={className}>
      <Series1DashboardCardHeader title="Capital flow" />
      <Stepper
        size="xs"
        className="m-0 flex-1 list-none p-[var(--ct-space-5)]"
        steps={FLOW_STEPS.map((step, index) => ({
          label: step.label,
          detail: step.detail,
          active: index === FLOW_STEPS.length - 1,
        }))}
      />
    </Series1DashboardCard>
  );
}
