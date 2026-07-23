// Series1AllocationCockpit — the dashboard's decision instrument (PROMPT 029).
//
// It composes, in one card, the four allocation signals a B2B reader needs:
//   1. Policy target B1/B2/B3 (a SPEC CONSTANT, always known).
//   2. On-chain / actual split — only when a real measurement exists.
//   3. Drift (target vs actual) — rendered ONLY when BOTH inputs are real.
//      Never a fabricated drift: if actual is absent, drift is "not available".
//   4. A source-health strip + a proof snapshot + subscription capacity.
//
// No fake data, no BTC curve, no null→0. When a signal is missing the surface
// says so once, honestly, and shows no number.
//
// Presentational only: it receives already-resolved values from the dashboard
// composition; it performs no I/O.

import Link from "next/link";

import { HcStackedBar } from "@/components/dataviz/his";
import { cn } from "@/lib/cn";
import { surfaceNoticeWell } from "@/lib/ui/surface-classes";

import {
  Series1DashboardCard,
  Series1DashboardCardHeader,
} from "./Series1DashboardSection";
import { Series1DataState } from "./Series1DataState";
import type { Series1Pocket } from "./Series1CapitalArchitecture";

/** Health of one upstream source, shown as a compact status chip. */
export interface Series1SourceHealth {
  label: string;
  status: "live" | "not_configured" | "unavailable";
}

/** The last indexed proof event, when one exists. */
export interface Series1ProofSnapshot {
  /** Human label, e.g. "Deposit". Null when no event is indexed yet. */
  lastEventLabel: string | null;
  /** e.g. "Fork preprod" / "Mainnet" / "Network mismatch". */
  chainLabel: string | null;
}

/** Subscription capacity signal — only fields that have a real source. */
export interface Series1SubscriptionState {
  /** Minimum ticket, pre-formatted (e.g. "$100,000"). Null if not reported. */
  minimum: string | null;
  /** Hard cap, pre-formatted. Null if not reported (never shown as 0). */
  hardCap: string | null;
}

export interface Series1AllocationCockpitProps {
  /** Policy target — always present (spec constant). */
  target: readonly Series1Pocket[];
  /** Measured on-chain split, or null when no real measurement exists. */
  actual: readonly Series1Pocket[] | null;
  /** Why actual is absent, when it is (shown once, honestly). */
  actualMotive?: string;
  sources: readonly Series1SourceHealth[];
  proof: Series1ProofSnapshot;
  subscription: Series1SubscriptionState;
  className?: string;
}

const STATUS_LABEL: Record<Series1SourceHealth["status"], string> = {
  live: "Live",
  not_configured: "Not configured",
  unavailable: "Unavailable",
};

export function Series1AllocationCockpit({
  target,
  actual,
  actualMotive,
  sources,
  proof,
  subscription,
  className,
}: Series1AllocationCockpitProps) {
  // Drift is a comparison of two REAL vectors. Without a measured `actual`
  // there is nothing to compare — we render "not available", never a zero drift.
  const drift =
    actual !== null
      ? target.map((t) => {
          const a = actual.find((p) => p.id === t.id);
          return { id: t.id, label: t.label, delta: a ? a.value - t.value : null };
        })
      : null;

  return (
    <Series1DashboardCard variant="secondary" className={className}>
      <Series1DashboardCardHeader
        title="Allocation cockpit"
        caption="Policy target against the on-chain split — the gap is the information"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-[var(--ct-space-5)] px-[var(--ct-space-6)] py-[var(--ct-space-5)]">
        {/* 1 — Policy target (always known). */}
        <AllocationBarRow
          label="Policy target"
          sub="VAULT_SPEC v2.1 §6 — configured, not a measurement"
          pockets={target}
          showLegend
        />

        {/* 2 — On-chain / actual, or an honest empty bar. */}
        {actual ? (
          <AllocationBarRow
            label="On-chain"
            sub="strategies() — measured on the contract"
            pockets={actual}
          />
        ) : (
          <div>
            <p
              className="m-0 font-medium uppercase tracking-[0.12em] text-[var(--ct-text-faint)]"
              style={{ fontSize: "var(--ct-text-nano)" }}
            >
              On-chain
            </p>
            <div className="mt-[var(--ct-space-2)] h-[12px] rounded-[var(--ct-radius-full)] ring-1 ring-inset ring-[var(--ct-border-soft)]" />
          </div>
        )}

        {/* 3 — Drift per pocket, only when both inputs are real. */}
        <div>
          <p
            className="m-0 font-medium uppercase tracking-[0.12em] text-[var(--ct-text-muted)]"
            style={{ fontSize: "var(--ct-text-nano)" }}
          >
            Drift · target vs on-chain
          </p>
          {drift ? (
            <dl className="mt-[var(--ct-space-2)] grid grid-cols-3 gap-[var(--ct-space-3)]">
              {drift.map((d) => (
                <div key={d.id} className="min-w-0">
                  <dt
                    className="m-0 truncate text-[var(--ct-text-faint)]"
                    style={{ fontSize: "var(--ct-text-nano)" }}
                  >
                    {d.id} · {d.label}
                  </dt>
                  <dd
                    className="m-0 mt-[var(--ct-space-1)] font-semibold tabular-nums text-[var(--ct-text-strong)]"
                    style={{ fontSize: "var(--ct-text-sm)" }}
                  >
                    {d.delta === null
                      ? "—"
                      : `${d.delta > 0 ? "+" : ""}${d.delta.toFixed(1)} pt`}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p
              className="m-0 mt-[var(--ct-space-1)] text-[var(--ct-text-faint)]"
              style={{ fontSize: "var(--ct-text-2xs)" }}
            >
              Not available — a live on-chain split is required to compute drift.
            </p>
          )}
        </div>

        {/* 4a — Source health strip. */}
        <div className="min-w-0">
          <p
            className="m-0 font-medium uppercase tracking-[0.12em] text-[var(--ct-text-muted)]"
            style={{ fontSize: "var(--ct-text-nano)" }}
          >
            Source health
          </p>
          <ul className="mt-[var(--ct-space-2)] flex flex-wrap gap-[var(--ct-space-2)]">
            {sources.map((s) => (
              <li
                key={s.label}
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ring-1 ring-inset ring-[var(--ct-border-soft)]"
                style={{ fontSize: "var(--ct-text-nano)" }}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 rounded-full",
                    s.status === "live"
                      ? "bg-[var(--ct-accent)]"
                      : "bg-[var(--ct-text-faint)]",
                  )}
                />
                <span className="text-[var(--ct-text-muted)]">{s.label}</span>
                <span className="text-[var(--ct-text-faint)]">· {STATUS_LABEL[s.status]}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 4b — Subscription capacity + proof snapshot, side by side. */}
        <div className="grid grid-cols-1 gap-[var(--ct-space-4)] sm:grid-cols-2">
          <div className="min-w-0">
            <p
              className="m-0 font-medium uppercase tracking-[0.12em] text-[var(--ct-text-muted)]"
              style={{ fontSize: "var(--ct-text-nano)" }}
            >
              Subscription
            </p>
            <p
              className="m-0 mt-[var(--ct-space-1)] tabular-nums text-[var(--ct-text-strong)]"
              style={{ fontSize: "var(--ct-text-sm)" }}
            >
              {subscription.hardCap ?? "Cap not reported"}
            </p>
            <p
              className="m-0 text-[var(--ct-text-faint)]"
              style={{ fontSize: "var(--ct-text-nano)" }}
            >
              {subscription.minimum ? `Minimum ${subscription.minimum}` : "Minimum not reported"}
            </p>
            {/* Link on its own line — an accent link inside faint copy fails
                the 3:1 link-vs-surrounding-text contrast rule (a11y runner). */}
            <Link
              href="/vaults"
              className="mt-[var(--ct-space-1)] inline-block font-medium text-[var(--ct-accent-strong)] underline hover:no-underline"
              style={{ fontSize: "var(--ct-text-nano)" }}
            >
              Subscribe →
            </Link>
          </div>

          <div className="min-w-0">
            <p
              className="m-0 font-medium uppercase tracking-[0.12em] text-[var(--ct-text-muted)]"
              style={{ fontSize: "var(--ct-text-nano)" }}
            >
              Proof snapshot
            </p>
            <p
              className="m-0 mt-[var(--ct-space-1)] truncate text-[var(--ct-text-strong)]"
              style={{ fontSize: "var(--ct-text-sm)" }}
            >
              {proof.lastEventLabel ?? "No event indexed yet"}
            </p>
            {proof.chainLabel ? (
              <p
                className="m-0 text-[var(--ct-text-faint)]"
                style={{ fontSize: "var(--ct-text-nano)" }}
              >
                {proof.chainLabel}
              </p>
            ) : null}
            {/* Link on its own line — see subscription note above. */}
            <Link
              href="/proof-center"
              className="mt-[var(--ct-space-1)] inline-block font-medium text-[var(--ct-accent-strong)] underline hover:no-underline"
              style={{ fontSize: "var(--ct-text-nano)" }}
            >
              Proof Center →
            </Link>
          </div>
        </div>
      </div>

      {actual === null && actualMotive ? (
        <div className={cn(surfaceNoticeWell, "px-[var(--ct-space-5)] py-[var(--ct-space-3)]")}>
          <Series1DataState motive="Configured policy split" detail={actualMotive} />
        </div>
      ) : null}
    </Series1DashboardCard>
  );
}

/** One labelled allocation bar (shared shape with Series1CapitalArchitecture). */
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
