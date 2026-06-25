import "../portfolio.css";

import { loadPortfolioView } from "@/lib/data/portfolio-view";
import { PortfolioLeafShell } from "@/components/portfolio/portfolio-leaf-shell";
import { ApyRange } from "@/components/ui/apy-range";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { formatUsdCompact, formatUsdFull } from "@/lib/vaults/product-display";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { POSITION_STATUS_CONFIG, type PortfolioPosition } from "@/lib/data/portfolio";
import { cn } from "@/lib/cn";
import Link from "next/link";
import {
  ArrowLeft,
  Wallet,
  TrendingUp,
  Layers,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Positions",
  description: "Your active vault positions",
};

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function PositionCard({ position }: { position: PortfolioPosition }) {
  const statusConfig = POSITION_STATUS_CONFIG[position.status];
  const gainPct =
    position.principalUsdc > 0
      ? ((position.valueUsdc - position.principalUsdc) / position.principalUsdc) * 100
      : null;

  return (
    <div className="pf-leaf-position-card">
      {/* Card header */}
      <div className="pf-leaf-pos-header">
        <div className="pf-leaf-pos-header__left">
          <span
            className={cn("pf-status-dot", statusConfig.dot)}
            aria-hidden
          />
          <div>
            <h3 className="pf-leaf-pos-name">
              {position.vaultName ?? "Unassigned vault"}
            </h3>
            <span className="pf-leaf-pos-status">{statusConfig.label}</span>
          </div>
        </div>
        <Link
          href={`/portfolio/${position.id}`}
          className="pf-leaf-pos-detail-link"
          aria-label={`View details for ${position.vaultName ?? "this position"}`}
        >
          <ExternalLink size={13} aria-hidden />
          Details
        </Link>
      </div>

      {/* KPI grid */}
      <div className="pf-leaf-pos-kpis">
        <div className="pf-leaf-pos-kpi">
          <span className="pf-leaf-pos-kpi__label">Principal</span>
          <span className="pf-leaf-pos-kpi__value tabular">
            {formatUsdFull(position.principalUsdc)}
          </span>
          <span className="pf-leaf-pos-kpi__sub">Net deposits</span>
        </div>

        <div className="pf-leaf-pos-kpi">
          <span className="pf-leaf-pos-kpi__label">Current value</span>
          <span className="pf-leaf-pos-kpi__value tabular ct-text-accent font-bold">
            {formatUsdFull(position.valueUsdc)}
          </span>
          {gainPct !== null && Math.abs(gainPct) > 0.01 && (
            <span className={cn(
              "pf-leaf-pos-kpi__sub tabular",
              gainPct >= 0 ? "pf-leaf-pos-kpi__sub--positive" : "pf-leaf-pos-kpi__sub--negative",
            )}>
              {gainPct >= 0 ? "+" : ""}
              {gainPct.toFixed(2)}%
            </span>
          )}
        </div>

        <div className="pf-leaf-pos-kpi">
          <span className="pf-leaf-pos-kpi__label">Target APY</span>
          <span className="pf-leaf-pos-kpi__value">
            {position.apyLow !== null && position.apyHigh !== null ? (
              <ApyRange
                low={position.apyLow}
                high={position.apyHigh}
                precision={1}
                className="tabular font-semibold"
              />
            ) : (
              <span className="pf-leaf-pos-kpi__value--dim">Unavailable</span>
            )}
          </span>
          <span className="pf-leaf-pos-kpi__sub">Range</span>
        </div>

        <div className="pf-leaf-pos-kpi">
          <span className="pf-leaf-pos-kpi__label">Accrued yield</span>
          <span className={cn(
            "pf-leaf-pos-kpi__value tabular",
            position.accruedYieldUsdc > 0 && "pf-leaf-kpi-value--accent",
          )}>
            {position.accruedYieldUsdc > 0
              ? formatUsdFull(position.accruedYieldUsdc)
              : "—"}
          </span>
          <span className="pf-leaf-pos-kpi__sub">Pending payout</span>
        </div>
      </div>

      {/* Footer */}
      <div className="pf-leaf-pos-footer">
        <span className="pf-leaf-pos-footer__item">
          <span className="pf-leaf-pos-footer__label">Subscribed</span>
          <span className="pf-leaf-pos-footer__value tabular">
            {dateFmt.format(position.subscribedAt)}
          </span>
        </span>
        {position.distributedUsdc > 0 && (
          <span className="pf-leaf-pos-footer__item">
            <span className="pf-leaf-pos-footer__label">Distributed</span>
            <span className="pf-leaf-pos-footer__value tabular ct-text-accent">
              {formatUsdFull(position.distributedUsdc)}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

export default async function PositionsPage() {
  const { data, hasPositions } = await loadPortfolioView();
  const { positions, source, updatedAt } = data;
  const provenance = hasPositions ? resolveProvenance(source, updatedAt) : undefined;

  const totalPrincipal = positions.reduce((s, p) => s + p.principalUsdc, 0);
  const totalValue = positions.reduce((s, p) => s + p.valueUsdc, 0);
  const totalAccrued = positions.reduce((s, p) => s + p.accruedYieldUsdc, 0);
  const totalDistributed = positions.reduce((s, p) => s + p.distributedUsdc, 0);
  const activeCount = positions.filter((p) => p.status === "active").length;
  const deployedPct =
    hasPositions && totalValue > 0
      ? Math.min(100, (data.deployedUsdc / totalValue) * 100)
      : 0;

  return (
    <PortfolioLeafShell testId="portfolio-positions-page">
      <div className="pf-leaf-page">
        {/* ── Back nav ── */}
        <div className="pf-leaf-back-nav">
          <Link href="/portfolio" className="pf-leaf-back-link">
            <ArrowLeft size={14} aria-hidden />
            Portfolio
          </Link>
          <span className="pf-leaf-back-sep" aria-hidden>/</span>
          <span className="pf-leaf-back-current">Positions</span>
        </div>

        {/* ── Page header ── */}
        <div className="pf-leaf-header">
          <div className="pf-leaf-header__left">
            <p className="pf-leaf-eyebrow">Portfolio</p>
            <h1 className="pf-leaf-title">Positions</h1>
            <p className="pf-leaf-desc">
              {hasPositions
                ? `${positions.length} position${positions.length !== 1 ? "s" : ""} — ${activeCount} active, ${formatUsdCompact(totalValue)} current value.`
                : "Your vault positions appear here once your first subscription is confirmed on-chain."}
            </p>
          </div>
          {provenance && (
            <div className="pf-leaf-header__badge">
              <ProvenanceBadge kind={provenance} />
            </div>
          )}
        </div>

        {/* ── Summary KPIs ── */}
        {hasPositions && (
          <div className="pf-leaf-hero-row">
            <div className="pf-leaf-kpi-card">
              <span className="pf-leaf-kpi-label">
                <Wallet size={12} aria-hidden />
                Principal
              </span>
              <span className="pf-leaf-kpi-value tabular">
                {formatUsdCompact(totalPrincipal)}
              </span>
              <span className="pf-leaf-kpi-sub">Net deposits</span>
            </div>

            <div className="pf-leaf-kpi-card">
              <span className="pf-leaf-kpi-label">
                <TrendingUp size={12} aria-hidden />
                Current value
              </span>
              <span className="pf-leaf-kpi-value tabular ct-text-accent font-bold">
                {formatUsdCompact(totalValue)}
              </span>
              <span className="pf-leaf-kpi-sub">Principal + accrued</span>
            </div>

            <div className="pf-leaf-kpi-card">
              <span className="pf-leaf-kpi-label">
                <Layers size={12} aria-hidden />
                Deployed
              </span>
              <span className="pf-leaf-kpi-value tabular">
                {deployedPct.toFixed(0)}%
              </span>
              <span className="pf-leaf-kpi-sub">{formatUsdCompact(data.deployedUsdc)}</span>
            </div>

            <div className="pf-leaf-kpi-card">
              <span className="pf-leaf-kpi-label">
                <ShieldCheck size={12} aria-hidden />
                Accrued yield
              </span>
              <span className={cn(
                "pf-leaf-kpi-value tabular",
                totalAccrued > 0 && "pf-leaf-kpi-value--accent",
              )}>
                {totalAccrued > 0 ? formatUsdCompact(totalAccrued) : "—"}
              </span>
              <span className="pf-leaf-kpi-sub">Pending payout</span>
            </div>

            {totalDistributed > 0 && (
              <div className="pf-leaf-kpi-card">
                <span className="pf-leaf-kpi-label">
                  Distributed
                </span>
                <span className="pf-leaf-kpi-value tabular ct-text-accent">
                  {formatUsdCompact(totalDistributed)}
                </span>
                <span className="pf-leaf-kpi-sub">Total paid out</span>
              </div>
            )}
          </div>
        )}

        {/* ── Position cards ── */}
        <div className="pf-leaf-section">
          {hasPositions ? (
            <div className="pf-leaf-positions-list">
              {positions.map((p) => (
                <PositionCard key={p.id} position={p} />
              ))}
            </div>
          ) : (
            <div className="pf-leaf-section__card pf-leaf-section__card--empty">
              {/* Skeleton placeholder rows */}
              <div className="pf-leaf-pos-skeleton" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="pf-leaf-pos-skeleton-row">
                    <span className="pf-leaf-pos-skeleton-dot" />
                    <span className="pf-leaf-pos-skeleton-bar pf-leaf-pos-skeleton-bar--name" />
                    <span className="pf-leaf-pos-skeleton-bar pf-leaf-pos-skeleton-bar--num" />
                    <span className="pf-leaf-pos-skeleton-bar pf-leaf-pos-skeleton-bar--num" />
                  </div>
                ))}
              </div>
              <p className="pf-leaf-empty-title">No positions yet</p>
              <p className="pf-leaf-empty-text">
                Your vault positions appear here once your first subscription is confirmed on-chain.
                Minimum subscription: $250,000 USDC.
              </p>
            </div>
          )}
        </div>

        {/* ── Position table (compact ledger view) ── */}
        {hasPositions && positions.length > 1 && (
          <div className="pf-leaf-section">
            <div className="pf-leaf-section__card">
              <div className="pf-leaf-section__head">
                <h2 className="pf-leaf-section-title">Summary table</h2>
              </div>
              <div className="pf-leaf-pos-table">
                <div className="pf-leaf-pos-table-row pf-leaf-pos-table-row--head">
                  <span>Vault</span>
                  <span className="pf-leaf-pos-table-num">Principal</span>
                  <span className="pf-leaf-pos-table-num">Value</span>
                  <span className="pf-leaf-pos-table-num">APY range</span>
                  <span className="pf-leaf-pos-table-num">Since</span>
                </div>
                {positions.map((p) => {
                  const cfg = POSITION_STATUS_CONFIG[p.status];
                  return (
                    <div key={p.id} className="pf-leaf-pos-table-row">
                      <span className="pf-leaf-pos-table-vault">
                        <span className={cn("pf-status-dot", cfg.dot)} aria-hidden />
                        <Link
                          href={`/portfolio/${p.id}`}
                          className="body-sm ct-text-strong font-medium hover:underline underline-offset-4"
                        >
                          {p.vaultName ?? "Unassigned vault"}
                        </Link>
                      </span>
                      <span className="pf-leaf-pos-table-num tabular body-sm">
                        {formatUsdCompact(p.principalUsdc)}
                      </span>
                      <span className="pf-leaf-pos-table-num tabular body-sm ct-text-accent font-bold">
                        {formatUsdCompact(p.valueUsdc)}
                      </span>
                      <span className="pf-leaf-pos-table-num">
                        {p.apyLow !== null && p.apyHigh !== null ? (
                          <ApyRange low={p.apyLow} high={p.apyHigh} precision={1} className="body-xs font-semibold" />
                        ) : (
                          <span className="body-xs ct-text-tertiary">—</span>
                        )}
                      </span>
                      <span className="pf-leaf-pos-table-num body-xs ct-text-tertiary tabular">
                        {dateFmt.format(p.subscribedAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Proof strip ── */}
        {hasPositions && (
          <div className="pf-leaf-proof-strip">
            <ShieldCheck size={14} aria-hidden />
            <span>Underlying proof:</span>
            <span className={cn(
              "pf-leaf-proof-status",
              source === "live" && "pf-leaf-proof-status--live",
            )}>
              {source === "live" ? "Current" : "Pending"}
            </span>
            {updatedAt && (
              <span className="pf-leaf-proof-date">
                As of {dateFmt.format(updatedAt)}
              </span>
            )}
          </div>
        )}

        <p className="pf-leaf-disclaimer">
          Position values are indicative — not guaranteed. Conditional projection per Hearst methodology.
        </p>
      </div>
    </PortfolioLeafShell>
  );
}
