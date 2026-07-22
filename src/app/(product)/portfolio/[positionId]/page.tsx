// Vault Details (/portfolio/[positionId]) — recomposed on the /portfolio/preview
// canon: ONE dominant shadowed hero (value trajectory + edge stat band) followed
// by titled hairline "acts" — NO collapsible accordions, no cage-in-cage. Every
// support surface is a bare hairline card; the chrome budget reserves elevation
// for the hero alone. Symmetric 1fr/1fr grids. Bound to real data (loadPosition);
// every projection an honest range, never a promise. Next.js 16 async params.
//
// v2 note-of-mining model: the position ACCUMULATES BTC over its term with
// rule-based take-profit — there is NO periodic cash distribution, so this page
// carries no monthly-payout calendar and no "yield paid" tallies.

import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/catalyst/badge";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { StepTimeline } from "@/components/catalyst/step-timeline";
import { StatBand, type StatCell } from "@/app/(product)/portfolio/preview/_charts/stat-band";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import {
  CapitalFlowRail,
  type CapitalFlowRailData,
} from "@/features/investor-ui/components/reserve-cockpit";
import {
  B1_MINING_ALLOCATION_BPS,
  B2_BTC_ALLOCATION_BPS,
  B3_USDC_ALLOCATION_BPS,
} from "@/lib/products/dynavault-factsheet";
import { ValueTrajectory } from "@/components/portfolio/value-trajectory";
import { LockArc } from "@/components/portfolio/lock-arc";
import { CumulativeTargetBullet } from "@/components/portfolio/cumulative-target-bullet";
import { PositionCapitalProtection } from "@/components/portfolio/position-capital-protection";
import { PositionStrategyAllocation } from "@/components/portfolio/position-strategy-allocation";
import { PositionInfrastructureProofs } from "@/components/portfolio/position-infrastructure-proofs";
import { projectValueTrajectory } from "@/lib/engine/value-projection";
import { explorerTxUrl } from "@/lib/chain/explorer";
import { loadPosition, POSITION_STATUS_CONFIG } from "@/lib/data/portfolio";
import { formatAdminDate, formatUsdFull } from "@/lib/vaults/product-display";

const SERIES1_VAULT_LABEL = "Series 1 Reserve Vault";

export const dynamic = "force-dynamic";

export const metadata = { title: "Position — Series 1 Reserve Vault" };

interface PageProps {
  params: Promise<{ positionId: string }>;
}

const TABLE_HEAD = "bg-transparent ct-bento-label";
const ROW =
  "border-transparent transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)]";

const TX_LABEL: Record<string, string> = {
  deposit: "Deposit",
  claim: "Claim",
  withdraw: "Withdrawal",
  distribution: "Proceeds",
};

const DAY_MS = 86_400_000;

/** Bare-hairline support surface — the chrome budget reserves elevation for the hero. */
const SUPPORT =
  "rounded-2xl border border-[var(--ct-border)] bg-surface-card overflow-hidden";
const HERO_SHADOW = "var(--ct-shadow-depth), var(--ct-glass-bevel-subtle)";

/** Compact meta chip — label + tabular value on a hairline pill. Token-only. */
function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] px-2 py-0.5">
      <span className="ct-bento-label">{label}</span>
      <span className="text-[length:var(--ct-text-xs)] ct-text-strong tabular-nums">
        {value}
      </span>
    </span>
  );
}

/** Titled hairline divider — opens an act without boxing it in a card (kills cage-in-cage). */
function TitledDivider({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <div className="flex items-center gap-4 pt-2">
      <h2 className="ct-section-title shrink-0">{title}</h2>
      <span
        aria-hidden="true"
        className="h-px flex-1"
        style={{ background: "var(--ct-border-soft)" }}
      />
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

/** Hairline card header — micro label + optional trailing slot. */
function CardHeader({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--ct-border-soft)] px-5 py-4">
      <span className="ct-bento-label">{title}</span>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

export default async function VaultDetailPage({ params }: PageProps) {
  const { positionId } = await params;
  const position = await loadPosition(positionId);
  if (!position) notFound();

  const now = new Date();
  const value = position.principalUsdc + position.accruedYieldUsdc;
  const perfPct =
    position.principalUsdc > 0
      ? ((value - position.principalUsdc) / position.principalUsdc) * 100
      : 0;
  const up = perfPct >= 0;

  const hasAccumulationRange =
    position.realizedApyLow !== null && position.realizedApyHigh !== null;
  const accumulationLowPct = position.realizedApyLow ?? 0;
  const accumulationHighPct = position.realizedApyHigh ?? 0;

  const openTxUrl = position.txHashOpen ? explorerTxUrl(position.txHashOpen) : null;

  // Effective maturity anchor for the engines below. `position.maturedAt` is
  // always null pre-Phase-2, so the mechanical horizon is `subscribedAt +
  // softLockupDays`. For a position that is still `active` in the ledger but
  // whose mechanical horizon already fell in the past (renewal / pending
  // settlement — the ledger status is the source of truth, not the derived
  // date), anchor the engines' horizon at "now + term" instead of a stale
  // past date — otherwise the pure engine reads `matured: true` and silently
  // drops the forward projection cone, which is how an active $250k position
  // showed "Matured" while still live.
  const mechanicalHorizonMs = position.maturedAt
    ? position.maturedAt.getTime()
    : position.softLockupDays > 0
      ? position.subscribedAt.getTime() + position.softLockupDays * DAY_MS
      : now.getTime() + 365 * DAY_MS;
  const effectiveMaturityAt =
    position.status === "active" && mechanicalHorizonMs <= now.getTime()
      ? new Date(
          now.getTime() +
            (position.softLockupDays > 0 ? position.softLockupDays * DAY_MS : 365 * DAY_MS),
        )
      : position.maturedAt;

  // Engine (pure, clock injected) — the honest value cone.
  const projection = projectValueTrajectory({
    principalUsdc: position.principalUsdc,
    currentValueUsdc: value,
    realizedApyLowPct: accumulationLowPct,
    realizedApyHighPct: accumulationHighPct,
    subscribedAt: position.subscribedAt,
    now,
    maturityAt: effectiveMaturityAt,
    softLockupDays: position.softLockupDays,
  });

  const daysHeld = Math.max(
    0,
    Math.floor((now.getTime() - position.subscribedAt.getTime()) / DAY_MS),
  );
  // Maturity label follows the position's REAL lifecycle status — with
  // effectiveMaturityAt above, `projection.matured` is now only ever true when
  // the position is genuinely matured/exited, so it cannot disagree with an
  // `active` status.
  const horizonLabel =
    position.status === "matured" || projection.matured
      ? "Matured"
      : formatAdminDate(new Date(projection.horizonMs));

  const statusColor =
    position.status === "active"
      ? "green"
      : position.status === "matured"
        ? "amber"
        : "zinc";

  const isActive = position.status === "active";

  // Hero edge stat band — the position's four real headline metrics (4-up = a
  // perfectly symmetric rail, StatBand caps at 4 cols). Deposited (Manual) ·
  // Current value (Attested + delta) · Accrued value (Estimated — BTC/value
  // accumulated, NOT distributed) · Est. BTC delivery range (Estimated). Maturity
  // moves to a header chip. No red anywhere.
  const deliveryRangeLabel = hasAccumulationRange
    ? `${formatUsdFull(projection.maturityLo)}–${formatUsdFull(projection.maturityHi)}`
    : "—";

  const heroStats: StatCell[] = [
    {
      label: "Deposited",
      value: formatUsdFull(position.principalUsdc),
      provenance: "manual",
    },
    {
      label: "Current value",
      value: formatUsdFull(value),
      delta: {
        text: `${up ? "+" : ""}${perfPct.toFixed(2)}%`,
        tone: up ? "up" : "down",
      },
      provenance: "attested",
    },
    {
      label: "Accrued (est.)",
      value: formatUsdFull(position.accruedYieldUsdc),
      provenance: "estimated",
    },
    {
      label: "Est. BTC delivery",
      value: deliveryRangeLabel,
      provenance: "estimated",
    },
  ];

  // ── Capital-flow rail — the Series 1 narrative (deposit → B1/B2/B3 → BTC
  //    Reserve Ledger → delivery at maturity) for THIS position. Weights come
  //    from the canonical factsheet bps (single source of truth, identical to
  //    the Strategy allocation panel below); the deposit amount is this
  //    position's REAL principal. Structural policy split → Estimated. Shown
  //    only for a funded position (principal > 0) — never a fabricated $0 flow.
  const BPS_PER_PERCENT = 100;
  const capitalFlowData: CapitalFlowRailData | null =
    position.principalUsdc > 0
      ? {
          depositLabel: "USDC",
          depositAmount: formatUsdFull(position.principalUsdc),
          pockets: [
            {
              id: "B1",
              label: "Mining Power",
              weightPct: B1_MINING_ALLOCATION_BPS / BPS_PER_PERCENT,
            },
            {
              id: "B2",
              label: "BTC Pouch",
              weightPct: B2_BTC_ALLOCATION_BPS / BPS_PER_PERCENT,
            },
            {
              id: "B3",
              label: "Reserve USDC",
              weightPct: B3_USDC_ALLOCATION_BPS / BPS_PER_PERCENT,
            },
          ],
          ledgerLabel: "BTC Reserve Ledger",
          deliveryLabel: "Delivery at maturity",
        }
      : null;

  return (
    // The console body keeps its own `dark` scope: the bento/chart tokens it
    // renders (--ct-surface-*) are defined dark at :root, so stripping the
    // scope would leave dark panels under light text. It is framed as one
    // deliberate inset panel inside the KYC cockpit page.
    <div className="dark mb-8 flex flex-col overflow-hidden rounded-2xl bg-surface-page [--gutter:theme(spacing.8)]">
      <div className="flex flex-col gap-y-8 p-5 lg:p-6">
        {/* HEADER */}
        <header className="flex flex-col gap-3 pb-1">
          <Link
            href="/my-vaults"
            className="ct-metric-caption w-fit transition-colors hover:text-[var(--ct-text-strong)]"
          >
            ← Vaults
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="h1 shrink-0">{position.vaultName ?? SERIES1_VAULT_LABEL}</h1>
              <p className="page-canon-kicker">
                {position.vaultTicker} · SUBSCRIBED{" "}
                {formatAdminDate(position.subscribedAt).toUpperCase()}
              </p>
            </div>
            <Badge color={statusColor} className="shrink-0 uppercase">
              {POSITION_STATUS_CONFIG[position.status].label}
            </Badge>
          </div>
          <div className="page-canon-rule" aria-hidden="true" />
        </header>

        {/* HERO — the one dominant band (glow + value trajectory + edge stat band) */}
        <section
          className="relative overflow-hidden rounded-2xl border border-[var(--ct-border)] bg-surface-card"
          style={{ boxShadow: HERO_SHADOW }}
          aria-label="Position value"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/4 h-64 w-[min(680px,80%)] opacity-[0.07]"
            style={{
              background:
                "radial-gradient(ellipse at center, var(--ct-accent) 0%, transparent 70%)",
            }}
          />
          <div className="relative z-10 flex flex-col">
            <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 lg:px-6 lg:pt-6">
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="ct-bento-label">Position overview · reserve trajectory to delivery</span>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="ct-metric-value text-[length:var(--ct-text-2xl)] tabular-nums">
                    {formatUsdFull(value)}
                  </span>
                  <span
                    className="text-[length:var(--ct-text-sm)] font-semibold tabular-nums"
                    style={{ color: "var(--ct-text-body)" }}
                  >
                    {up ? "+" : ""}
                    {perfPct.toFixed(2)}%
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <MetaChip label="Maturity" value={horizonLabel} />
                  <MetaChip
                    label="Lock-up"
                    value={
                      position.softLockupDays > 0
                        ? `${position.softLockupDays}d soft`
                        : "Open term"
                    }
                  />
                </div>
              </div>
              {isActive ? (
                <span
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[length:var(--ct-text-nano)] uppercase tracking-widest ct-text-body"
                  style={{ borderColor: "var(--ct-border-soft)" }}
                >
                  <span
                    aria-hidden="true"
                    className="hyv-pulse inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--ct-accent)", color: "var(--ct-accent)" }}
                  />
                  Active
                </span>
              ) : (
                <Badge color={statusColor} className="shrink-0 uppercase">
                  {POSITION_STATUS_CONFIG[position.status].label}
                </Badge>
              )}
            </div>

            {hasAccumulationRange ? (
              <ValueTrajectory
                projection={projection}
                nowValueLabel={formatUsdFull(value)}
                startLabel={formatAdminDate(position.subscribedAt)}
                endLabel={horizonLabel}
                aria-label="Position reserve trajectory: realized to date and estimated BTC delivery range at maturity"
              />
            ) : (
              // Honest guard: without a known accumulation range, the engine's
              // forward cone collapses to a fabricated zero-width band — rendering
              // it would present "no data" as a real projection. Show realized value only.
              <div className="p-5">
                <EmptySurface
                  variant="chart"
                  message="No reserve trajectory available for this position."
                  detail="This note's estimated BTC delivery range is not set — the realized value is shown without a forward projection."
                  ariaLabel="Position reserve trajectory: no BTC accumulation range available for projection"
                />
              </div>
            )}

            <div className="border-t border-[var(--ct-border-soft)]">
              <StatBand items={heroStats} />
            </div>
          </div>
        </section>

        {/* ── Act: Position mechanics ──────────────────────────────────────── */}
        <TitledDivider
          title="Position mechanics"
          trailing={<ProvenanceBadge kind="attested" variant="compact" />}
        />
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr]">
          <div className={SUPPORT}>
            <CardHeader title="Lock progress" />
            <LockArc daysHeld={daysHeld} lockupDays={position.softLockupDays} />
          </div>
          <div className={SUPPORT}>
            <CardHeader
              title="Accumulation progress"
              trailing={<ProvenanceBadge kind="estimated" variant="compact" />}
            />
            <CumulativeTargetBullet distributedUsdc={position.distributedUsdc} />
          </div>
        </section>
        <p className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
          Your invested capital unlocks for withdrawal at the note&apos;s 24-month
          term or the soft lock-up horizon (contractual, not enforced on-chain),
          whichever comes first. Projections are conditional and not guaranteed.
        </p>

        {/* ── Act: Capital protection ──────────────────────────────────────── */}
        <TitledDivider
          title="Capital protection"
          trailing={<ProvenanceBadge kind="manual" variant="compact" />}
        />
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr]">
          {/* Safeguard status + how-it-works timeline */}
          <div className={`${SUPPORT} flex flex-col`}>
            <CardHeader title="Safeguard status" />
            <div className="flex flex-col gap-5 p-5">
              <div className="flex items-start gap-3 rounded-[var(--ct-radius-lg)] border border-[var(--ct-status-success-border)] bg-[var(--ct-status-success-soft)] p-4">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--ct-status-success-border)]"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"
                      stroke="var(--ct-accent)"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9 12l2 2 4-4"
                      stroke="var(--ct-accent)"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="ct-metric-value" style={{ color: "var(--ct-accent)" }}>
                    Not triggered
                  </span>
                  <p className="ct-metric-caption">
                    Your principal is protected under the vault&apos;s structural
                    waterfall. The safeguard would only engage if value fell below
                    deposited capital at maturity.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <span className="ct-bento-label">How capital protection works</span>
                <StepTimeline
                  aria-label="How capital protection works"
                  steps={[
                    {
                      title: "Continuous monitoring",
                      description:
                        "The vault NAV is monitored against your deposited capital throughout the term.",
                    },
                    {
                      title: "Trigger condition",
                      description:
                        "If value is below the initial deposit at maturity, the safeguard engages automatically.",
                    },
                    {
                      title: "Capital recovery",
                      description:
                        "Mining proceeds are prioritised toward restoring principal ahead of new BTC accumulation. Deterministic in ordering, not guaranteed in outcome.",
                    },
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Structural safeguards + capital-at-work (real USDC figures) */}
          <div className={`${SUPPORT} flex flex-col`}>
            <CardHeader title="Structural safeguards" />
            <PositionCapitalProtection
              principalUsdc={position.principalUsdc}
              accruedYieldUsdc={position.accruedYieldUsdc}
              distributedUsdc={position.distributedUsdc}
              status={position.status}
              softLockupDays={position.softLockupDays}
              aria-label="Capital protection safeguards"
            />
          </div>
        </section>

        {/* ── Act: Capital flow — the Series 1 narrative rail (deposit → B1/B2/B3
            → BTC Reserve Ledger → delivery at maturity) for this position. Reads
            the FLOW end-to-end; the Strategy allocation panel below then details
            each pocket's role. Only rendered for a funded position — a $0 flow is
            never fabricated. Provenance Estimated (structural policy split). */}
        {capitalFlowData ? (
          <>
            <TitledDivider
              title="Capital flow"
              trailing={<ProvenanceBadge kind="estimated" variant="compact" />}
            />
            <CapitalFlowRail data={capitalFlowData} source="estimated" />
          </>
        ) : null}

        {/* ── Act: Strategy & transactions ─────────────────────────────────── */}
        <TitledDivider title="Strategy allocation & transactions" />
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr]">
          <div className={`${SUPPORT} flex flex-col`}>
            <CardHeader
              title="Strategy allocation"
              trailing={<ProvenanceBadge kind="estimated" variant="compact" />}
            />
            <PositionStrategyAllocation aria-label="Structural vault strategy allocation" />
          </div>

          <div className={`${SUPPORT} flex flex-col`}>
            <CardHeader
              title="Transactions"
              trailing={<ProvenanceBadge kind="attested" variant="compact" />}
            />
            {position.transactions.length > 0 ? (
              <Table
                dense
                className="[--gutter:0px] max-w-full [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap"
              >
                <TableHead>
                  <TableRow>
                    <TableHeader className={`${TABLE_HEAD} pl-5`}>Date</TableHeader>
                    <TableHeader className={`${TABLE_HEAD} text-center`}>Type</TableHeader>
                    <TableHeader className={`${TABLE_HEAD} pr-5 text-right`}>Amount</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {position.transactions.map((t) => {
                    const out = t.type === "withdraw";
                    return (
                      <TableRow key={t.id} className={ROW}>
                        <TableCell className="ct-metric-caption pl-5">
                          {formatAdminDate(t.occurredAt)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge color="zinc" className="uppercase">
                            {TX_LABEL[t.type] ?? t.type}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`ct-metric-value pr-5 text-right ${
                            out ? "" : "text-[var(--ct-accent)]"
                          }`}
                        >
                          {out ? "−" : "+"}
                          {formatUsdFull(t.amountUsdc)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="p-10 text-center">
                <p className="ct-metric-caption">No transactions on this position yet.</p>
              </div>
            )}
            <p className="ct-metric-caption mt-auto border-t border-[var(--ct-border-soft)] p-5">
              This note accumulates BTC over its 24-month term with rule-based
              take-profit. There is no periodic cash distribution; proceeds and
              accrued BTC are delivered at the note&apos;s maturity.
            </p>
          </div>
        </section>

        {/* ── Act: Infrastructure & proofs ─────────────────────────────────── */}
        <TitledDivider
          title="Infrastructure & proofs"
          trailing={<ProvenanceBadge kind="attested" variant="compact" />}
        />
        <div className={SUPPORT}>
          <PositionInfrastructureProofs
            txHashOpen={position.txHashOpen}
            explorerUrl={openTxUrl}
            transactions={position.transactions}
            aria-label="Infrastructure and on-chain proofs"
          />
        </div>

        {/* single global disclaimer */}
        <p className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
          Projections are conditional ranges, never a commitment — they assume the
          note&apos;s estimated BTC accumulation range at maturity, net of fees.
          Capital protection is best-effort and structural, never guaranteed.
        </p>
      </div>
    </div>
  );
}
