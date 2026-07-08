/**
 * /portfolio — the investor's REAL financial dashboard.
 *
 * Wired end-to-end on the signed-in investor's own persisted data
 * (`loadPortfolioDashboard`): deposit, current value, accrued + paid yield, NAV
 * history, lock-up progress and real distributions. NOTHING is mock. It starts
 * at ZERO (no position) and fills in after the first subscription.
 *
 * HONESTY (bank-grade product): only real figures render. Strategy / mining /
 * agent panels are intentionally OMITTED — they have no real data source yet
 * (they return when the rebalancing model is provided). The mock V4 vault-health
 * console lives at /portfolio/preview (sandbox).
 *
 * Visual language reused from the V4 kit: console access ribbon → ONE shadowed
 * hero (big current value + delta + value chart + edge stat band) → acts opened
 * by titled hairline dividers (lock-up, yield & distributions) → one footer
 * disclaimer. Chrome budget: one shadowed hero, every support surface bare
 * hairline. Green (accent) + heartbeat pulse reserved for the genuinely-Active
 * position. Token-only (--ct-*), changes none.
 */
import Link from "next/link";
import type { ReactNode } from "react";

import { ApyRange } from "@/components/catalyst/apy-range";
import { HcBarChart, HcValueChart } from "@/components/dataviz/his";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { loadPortfolioDashboard } from "@/lib/data/portfolio-dashboard";
import {
  formatUsdDetailed,
  formatUsdFull,
} from "@/lib/vaults/product-display";

import "./preview/_styles.css";
import { HcMeter, type MeterTick } from "./preview/_charts/meter";
import { StatBand, type StatCell } from "./preview/_charts/stat-band";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Portfolio",
  description: "Your Hearst Yield Vault position — deposit, value, yield and NAV history.",
};

/** Bare-hairline support surface (no shadow — the chrome budget reserves elevation for the hero). */
const SUPPORT =
  "rounded-2xl border border-[var(--ct-border)] bg-surface-card overflow-hidden";
const HERO_SHADOW = "var(--ct-shadow-depth), var(--ct-glass-bevel-subtle)";

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

/** Titled hairline divider — opens an act without boxing it in a card. */
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

function CardHeader({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--ct-border-soft)] px-5 py-4">
      <span className="ct-bento-label">{title}</span>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

const DISTRIB_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const MONTH_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

export default async function PortfolioPage() {
  const d = await loadPortfolioDashboard();

  // ── ZERO STATE ─────────────────────────────────────────────────────────────
  // A real dashboard at zero: honest empty hero + stat band at 0 + a subscribe
  // CTA. No fabricated Live badge, no mock chart — the surface simply has no
  // deployed capital yet.
  if (!d.hasPosition) {
    const zeroStats: readonly StatCell[] = [
      { label: "Deposit", value: formatUsdFull(0), provenance: "manual" },
      { label: "Current value", value: formatUsdFull(0), provenance: "manual" },
      { label: "Yield paid to date", value: formatUsdFull(0), provenance: "manual" },
      { label: "Accrued", value: formatUsdFull(0), provenance: "manual" },
    ];
    return (
      <div className="dark flex flex-col rounded-2xl bg-surface-page [--gutter:theme(spacing.8)] mb-8">
        <div className="flex flex-col gap-y-8 p-5 lg:p-6">
          {/* access ribbon (real KYC state) */}
          <div className="flex flex-wrap items-center gap-2">
            <MetaChip label="KYC" value={d.kycStatus ?? "pending"} />
            <MetaChip label="Access" value="B2B · qualified" />
          </div>

          {/* zero hero */}
          <section
            className="relative overflow-hidden rounded-2xl border border-[var(--ct-border)] bg-surface-card"
            style={{ boxShadow: HERO_SHADOW }}
            aria-label="Portfolio value"
          >
            <div className="relative z-10 flex flex-col">
              <div className="flex flex-wrap items-start justify-between gap-3 p-5 lg:p-6">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="ct-bento-label">Hearst Yield Vault</span>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h1 className="h1 shrink-0">
                      Current <span className="h1-accent">value</span>
                    </h1>
                    <span className="ct-metric-value text-[length:var(--ct-text-2xl)] tabular-nums">
                      {formatUsdFull(0)}
                    </span>
                  </div>
                  <span className="ct-metric-caption text-[length:var(--ct-text-sm)] leading-snug">
                    No capital deployed yet. Your deposit, yield and NAV history
                    will appear here after your first subscription.
                  </span>
                </div>
                <Link
                  href="/vaults"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--ct-accent)] bg-[var(--ct-accent)] px-3.5 py-1.5 text-[length:var(--ct-text-xs)] font-semibold text-[var(--ct-bg-deep)] transition-colors hover:bg-[color-mix(in_srgb,var(--ct-accent)_88%,var(--ct-bg-deep))]"
                >
                  Subscribe to a vault →
                </Link>
              </div>
              <div className="border-t border-[var(--ct-border-soft)]">
                <StatBand items={zeroStats} />
              </div>
            </div>
          </section>

          <p className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
            Figures reflect your own account only. Projections are not guaranteed
            and are shown as a range under stated assumptions.
          </p>
        </div>
      </div>
    );
  }

  // ── POPULATED STATE ──────────────────────────────────────────────────────────
  const deltaSign = d.totalChangePct >= 0 ? "+" : "";
  const deltaText = `${deltaSign}${d.totalChangePct.toFixed(1)}%`;
  const isActive = d.status === "active";

  const heroStats: readonly StatCell[] = [
    { label: "Deposit", value: formatUsdFull(d.depositUsdc), provenance: "attested" },
    {
      label: "Current value",
      value: formatUsdFull(d.currentValueUsdc),
      delta: { text: deltaText, tone: d.totalChangePct >= 0 ? "up" : "down" },
      provenance: "estimated",
    },
    {
      label: "Yield paid to date",
      value: formatUsdFull(d.distributedUsdc),
      provenance: "attested",
    },
    {
      label: "Accrued",
      value: formatUsdFull(d.accruedUsdc),
      provenance: "estimated",
    },
  ];

  const lockupTicks: readonly MeterTick[] =
    d.lockupDays > 0
      ? [
          { at: 0, label: "Day 0" },
          { at: d.lockupDays, label: `${d.lockupDays}d soft lock` },
        ]
      : [];

  // Monthly yield bars: realized (paid) months only — projection months are shown
  // as a range in the "next payout" caption, never as a fabricated paid bar.
  const yieldBars =
    d.yieldHistory?.months
      .filter((m) => m.status !== "projected")
      .map((m) => ({
        label: MONTH_YEAR.format(new Date(m.monthMs)),
        value: m.realizedUsdc,
      })) ?? [];

  const hasApy = d.apyLow !== null && d.apyHigh !== null;

  return (
    <div className="dark flex flex-col rounded-2xl bg-surface-page [--gutter:theme(spacing.8)] mb-8">
      <div className="flex flex-col gap-y-8 p-5 lg:p-6">
        {/* access ribbon (real KYC + share class) */}
        <div className="flex flex-wrap items-center gap-2">
          <MetaChip label="KYC" value={d.kycStatus ?? "pending"} />
          {d.shareClass ? <MetaChip label="Class" value={d.shareClass} /> : null}
          <MetaChip label="Access" value="B2B · qualified" />
          {hasApy ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] px-2 py-0.5">
              <span className="ct-bento-label">Target APY</span>
              <ApyRange
                low={d.apyLow!}
                high={d.apyHigh!}
                className="text-[length:var(--ct-text-xs)] ct-text-strong"
              />
            </span>
          ) : null}
        </div>

        {/* HERO — current value + delta + NAV chart + edge stat band */}
        <section
          className="relative overflow-hidden rounded-2xl border border-[var(--ct-border)] bg-surface-card"
          style={{ boxShadow: HERO_SHADOW }}
          aria-label="Portfolio value"
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
            <div className="flex flex-wrap items-start justify-between gap-3 p-5 lg:p-6">
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="ct-bento-label">Hearst Yield Vault</span>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h1 className="h1 shrink-0">
                    Current <span className="h1-accent">value</span>
                  </h1>
                  <span className="ct-metric-value text-[length:var(--ct-text-2xl)] tabular-nums">
                    {formatUsdFull(d.currentValueUsdc)}
                  </span>
                  <span className="text-[length:var(--ct-text-sm)] font-semibold ct-text-body tabular-nums">
                    {deltaText}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <MetaChip label="Deposit" value={formatUsdFull(d.depositUsdc)} />
                  {d.positions.length > 1 ? (
                    <MetaChip
                      label="Positions"
                      value={String(d.positions.length)}
                    />
                  ) : null}
                </div>
              </div>
              <span
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[length:var(--ct-text-nano)] uppercase tracking-widest ct-text-body"
                style={{ borderColor: "var(--ct-border-soft)" }}
              >
                {isActive ? (
                  <span
                    aria-hidden="true"
                    className="hyv-pulse inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--ct-accent)", color: "var(--ct-accent)" }}
                  />
                ) : null}
                {isActive ? "Active" : (d.status ?? "—")}
              </span>
            </div>
            <div className="px-5 lg:px-6">
              <HcValueChart
                points={d.navPoints}
                height={210}
                aria-label="Portfolio value over time"
              />
            </div>
            <div className="mt-4 border-t border-[var(--ct-border-soft)]">
              <StatBand items={heroStats} />
            </div>
          </div>
        </section>

        {/* ── Act: Lock-up ──────────────────────────────────────────────────── */}
        <TitledDivider
          title="Lock-up"
          trailing={<ProvenanceBadge kind="attested" variant="compact" />}
        />
        <div className={SUPPORT}>
          <div className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <span className="ct-bento-label">Soft lock-up progress</span>
              <span className="ct-metric-caption text-[length:var(--ct-text-nano)] tabular-nums">
                {d.lockupDays > 0
                  ? d.lockupRemainingDays > 0
                    ? `${d.lockupElapsedDays} / ${d.lockupDays} days · ${d.lockupRemainingDays} remaining`
                    : `Soft lock-up cleared (${d.lockupElapsedDays} days held)`
                  : `${d.lockupElapsedDays} days held`}
              </span>
            </div>
            {d.lockupDays > 0 ? (
              <HcMeter
                value={Math.min(d.lockupElapsedDays, d.lockupDays)}
                max={d.lockupDays}
                ticks={lockupTicks}
                tone="accent"
                aria-label="Soft lock-up progress"
              />
            ) : (
              <span className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
                No soft lock-up on this position.
              </span>
            )}
          </div>
        </div>

        {/* ── Act: Yield & distributions ────────────────────────────────────── */}
        <TitledDivider
          title="Yield & distributions"
          trailing={<ProvenanceBadge kind="attested" variant="compact" />}
        />
        <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-5">
          <div className={`${SUPPORT} flex flex-col`}>
            <CardHeader
              title="Distributions paid · by month"
              trailing={
                <span className="ct-metric-caption text-[length:var(--ct-text-nano)] tabular-nums">
                  {formatUsdFull(d.distributedUsdc)} paid to date
                </span>
              }
            />
            <div className="p-5">
              <HcBarChart
                bars={yieldBars}
                height={190}
                highlightLast
                emptyMessage="No distributions paid yet"
                aria-label="Monthly distributions paid"
              />
              {d.yieldHistory && hasApy ? (
                <p className="ct-metric-caption mt-4 border-t border-[var(--ct-border-soft)] pt-4 text-[length:var(--ct-text-nano)] leading-snug">
                  Next monthly payout projected at{" "}
                  <span className="tabular-nums ct-text-body">
                    {formatUsdDetailed(d.yieldHistory.nextPayoutLo)}
                  </span>{" "}
                  –{" "}
                  <span className="tabular-nums ct-text-body">
                    {formatUsdDetailed(d.yieldHistory.nextPayoutHi)}
                  </span>{" "}
                  under stated assumptions — a range, not guaranteed.
                </p>
              ) : null}
            </div>
          </div>
          <div className={`${SUPPORT} flex flex-col`}>
            <CardHeader title="Distribution history" />
            {d.distributions.length > 0 ? (
              <ul className="flex flex-col">
                {d.distributions.map((dist) => (
                  <li
                    key={dist.id}
                    className="flex items-center justify-between gap-3 border-b border-[var(--ct-border-soft)] px-5 py-3.5 last:border-b-0"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="text-[length:var(--ct-text-sm)] font-medium ct-text-strong tabular-nums">
                        {formatUsdDetailed(dist.amountUsdc)}
                      </span>
                      <span className="ct-metric-caption text-[length:var(--ct-text-nano)]">
                        {DISTRIB_DATE.format(dist.paidAt)}
                        {dist.vaultName ? ` · ${dist.vaultName}` : ""}
                      </span>
                    </div>
                    <ProvenanceBadge kind="attested" variant="compact" />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8">
                <span className="ct-metric-caption text-center text-[length:var(--ct-text-nano)] leading-snug">
                  No distributions yet. Paid USDC distributions will be listed
                  here as they settle.
                </span>
              </div>
            )}
          </div>
        </section>

        {/* single global disclaimer */}
        <p className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
          Figures reflect your own account only. Distributions shown are what was
          actually paid; forward figures are projections shown as a range under
          stated assumptions, not guaranteed. Current value includes unpaid
          accrued yield (Estimated) until it settles.
        </p>
      </div>
    </div>
  );
}
