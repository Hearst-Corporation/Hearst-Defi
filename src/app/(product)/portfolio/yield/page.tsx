import "../portfolio.css";

import { loadPortfolioView } from "@/lib/data/portfolio-view";
import { PortfolioLeafShell } from "@/components/portfolio/portfolio-leaf-shell";
import { ApyRange } from "@/components/ui/apy-range";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { formatUsdCompact, formatUsdFull } from "@/lib/vaults/product-display";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { METHODOLOGY_VERSION } from "@/lib/engine/methodology";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { ArrowLeft, TrendingUp, Layers, Wallet, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Yield & allocation",
  description: "Your blended yield and vault allocation breakdown",
};

const BUCKET_LABELS: Record<string, string> = {
  mining: "Bitcoin mining",
  usdc_base: "USDC base yield",
  btc_tactical: "BTC tactical",
  stable_reserve: "Stable reserve",
};

const BUCKET_COLOR: Record<string, string> = {
  mining: "var(--ct-accent)",
  usdc_base: "color-mix(in srgb, var(--ct-accent) 70%, var(--ct-text-neutral))",
  btc_tactical: "color-mix(in srgb, var(--ct-accent) 50%, var(--ct-text-neutral))",
  stable_reserve: "color-mix(in srgb, var(--ct-accent) 32%, var(--ct-text-neutral))",
};

export default async function YieldPage() {
  const { data, yieldStackProps, allocationDonutProps, hasPositions } = await loadPortfolioView();
  const { blendedLow, blendedHigh, sources, stressedBearRange } = yieldStackProps;
  const { buckets } = allocationDonutProps;

  const [rLow, rHigh] = blendedLow <= blendedHigh ? [blendedLow, blendedHigh] : [blendedHigh, blendedLow];

  const hasData =
    sources.length > 0 &&
    buckets.length > 0 &&
    data.totalValueUsdc > 0 &&
    sources.reduce((acc, s) => Math.max(acc, Math.abs(s.contributionPct)), 0) > 0;

  const showPartial = !hasData && hasPositions && data.totalValueUsdc > 0;
  const hasCapital = data.totalValueUsdc > 0;

  const provenance =
    hasCapital
      ? resolveProvenance(data.source, data.updatedAt, "estimated")
      : undefined;

  const deployedPct =
    hasPositions && data.totalValueUsdc > 0
      ? Math.min(100, (data.deployedUsdc / data.totalValueUsdc) * 100)
      : 0;

  const totalPct = buckets.reduce((sum, b) => sum + b.pct, 0);

  return (
    <PortfolioLeafShell testId="portfolio-yield-page">
      <div className="pf-leaf-page">
        {/* ── Back nav ── */}
        <div className="pf-leaf-back-nav">
          <Link href="/portfolio" className="pf-leaf-back-link">
            <ArrowLeft size={14} aria-hidden />
            Portfolio
          </Link>
          <span className="pf-leaf-back-sep" aria-hidden>/</span>
          <span className="pf-leaf-back-current">Yield &amp; allocation</span>
        </div>

        {/* ── Page header ── */}
        <div className="pf-leaf-header">
          <div className="pf-leaf-header__left">
            <p className="pf-leaf-eyebrow">Portfolio</p>
            <h1 className="pf-leaf-title">Yield &amp; allocation</h1>
            <p className="pf-leaf-desc">
              {hasData
                ? "Active capital breakdown, blended forward yield, and per-bucket allocation."
                : showPartial
                ? "Capital confirmed — allocation breakdown pending first vault snapshot."
                : "Allocation and yield targets appear once your position is confirmed on-chain."}
            </p>
          </div>
          {provenance && (
            <div className="pf-leaf-header__badge">
              <ProvenanceBadge kind={provenance} />
            </div>
          )}
        </div>

        {/* ── Hero metrics (always shown when capital exists) ── */}
        {hasCapital && (
          <div className="pf-leaf-hero-row">
            <div className="pf-leaf-kpi-card pf-leaf-kpi-card--accent">
              <span className="pf-leaf-kpi-label">
                <TrendingUp size={12} aria-hidden />
                Target APY
              </span>
              <span className="pf-leaf-kpi-value">
                <ApyRange low={rLow} high={rHigh} className="tabular" />
              </span>
              <span className="pf-leaf-kpi-sub">Blended forward · 12m</span>
            </div>

            <div className="pf-leaf-kpi-card">
              <span className="pf-leaf-kpi-label">
                <Wallet size={12} aria-hidden />
                Capital active
              </span>
              <span className="pf-leaf-kpi-value tabular">
                {formatUsdCompact(data.totalValueUsdc)}
              </span>
              <span className="pf-leaf-kpi-sub">Net deployed</span>
            </div>

            <div className="pf-leaf-kpi-card">
              <span className="pf-leaf-kpi-label">
                <Layers size={12} aria-hidden />
                Deployed
              </span>
              <span className="pf-leaf-kpi-value tabular">
                {hasPositions ? `${deployedPct.toFixed(0)}%` : "—"}
              </span>
              <span className="pf-leaf-kpi-sub">
                {hasPositions ? formatUsdCompact(data.deployedUsdc) : "No principal yet"}
              </span>
            </div>

            <div className="pf-leaf-kpi-card">
              <span className="pf-leaf-kpi-label">
                <TrendingUp size={12} aria-hidden />
                Accrued yield
              </span>
              <span className={cn(
                "pf-leaf-kpi-value tabular",
                hasPositions && data.accruedYieldUsdc > 0 && "pf-leaf-kpi-value--accent",
              )}>
                {hasPositions ? formatUsdFull(data.accruedYieldUsdc) : "—"}
              </span>
              <span className="pf-leaf-kpi-sub">Since inception</span>
            </div>
          </div>
        )}

        {/* ── APY band visual ── */}
        {hasCapital && (
          <div className="pf-leaf-section">
            <div className="pf-leaf-section__card">
              <div className="pf-leaf-section__head">
                <h2 className="pf-leaf-section-title">APY range</h2>
                <span className="pf-leaf-section-subtitle">
                  {rLow.toFixed(1)}% – {rHigh.toFixed(1)}% blended
                </span>
              </div>
              <div className="pf-leaf-apy-visual">
                <span className="pf-leaf-apy-anchor">{rLow.toFixed(1)}%</span>
                <div className="pf-leaf-apy-track">
                  <div
                    className="pf-leaf-apy-fill"
                    style={{
                      left: "0%",
                      right: `${Math.max(0, 100 - (rHigh / 20) * 100).toFixed(1)}%`,
                    }}
                  />
                </div>
                <span className="pf-leaf-apy-anchor pf-leaf-apy-anchor--high">{rHigh.toFixed(1)}%</span>
              </div>
              {stressedBearRange && (
                <p className="pf-leaf-apy-stress">
                  Bear scenario: {stressedBearRange.low.toFixed(1)}% – {stressedBearRange.high.toFixed(1)}%
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Allocation breakdown (when available) ── */}
        {hasData && buckets.length > 0 ? (
          <div className="pf-leaf-section">
            <div className="pf-leaf-section__card">
              <div className="pf-leaf-section__head">
                <h2 className="pf-leaf-section-title">Allocation</h2>
                <span className="pf-leaf-section-subtitle">By yield bucket</span>
              </div>

              {/* Segmented bar */}
              <div className="pf-leaf-alloc-bar-track" role="img" aria-label="Allocation by bucket">
                {buckets.map((b) => {
                  const segWidth = totalPct > 100 ? (b.pct / totalPct) * 100 : b.pct;
                  return (
                    <div
                      key={b.bucket}
                      className="pf-leaf-alloc-bar-seg"
                      style={{
                        width: `${segWidth}%`,
                        background: BUCKET_COLOR[b.bucket] ?? "var(--ct-accent)",
                      }}
                      aria-label={`${b.bucket} ${b.pct}%`}
                    />
                  );
                })}
              </div>

              {/* Bucket table */}
              <div className="pf-leaf-bucket-table">
                <div className="pf-leaf-bucket-row pf-leaf-bucket-row--head">
                  <span>Bucket</span>
                  <span className="pf-leaf-bucket-num">Allocation</span>
                  <span className="pf-leaf-bucket-num">APY contribution</span>
                </div>
                {buckets.map((b) => {
                  const src = sources.find((s) => s.bucket === b.bucket);
                  const contrib = src?.contributionPct ?? null;
                  const contribStr =
                    contrib !== null
                      ? src?.isVolatile
                        ? `±${Math.abs(contrib).toFixed(1)}%`
                        : contrib < 0
                        ? `−${Math.abs(contrib).toFixed(1)}%`
                        : `+${contrib.toFixed(1)}%`
                      : "—";

                  return (
                    <div key={b.bucket} className="pf-leaf-bucket-row">
                      <span className="pf-leaf-bucket-label-cell">
                        <span
                          className="pf-leaf-bucket-dot"
                          style={{ background: BUCKET_COLOR[b.bucket] ?? "var(--ct-accent)" }}
                          aria-hidden
                        />
                        {BUCKET_LABELS[b.bucket] ?? src?.label ?? b.bucket}
                      </span>
                      <span className="pf-leaf-bucket-num tabular">{b.pct}%</span>
                      <span
                        className={cn(
                          "pf-leaf-bucket-num tabular",
                          src?.isVolatile ? "pf-leaf-contrib--volatile" : "pf-leaf-contrib--positive",
                        )}
                      >
                        {contribStr}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : showPartial ? (
          <div className="pf-leaf-section">
            <div className="pf-leaf-section__card pf-leaf-section__card--notice">
              <span className="pf-leaf-notice-dot" aria-hidden />
              <div>
                <p className="pf-leaf-notice-title">Allocation pending</p>
                <p className="pf-leaf-notice-text">
                  Your position is active and capital is deployed. The vault allocation
                  breakdown is published at the start of each cycle — it will appear here once
                  the next snapshot is processed.
                </p>
              </div>
            </div>
          </div>
        ) : !hasCapital ? (
          <div className="pf-leaf-section">
            <div className="pf-leaf-section__card pf-leaf-section__card--empty">
              <p className="pf-leaf-empty-title">No position yet</p>
              <p className="pf-leaf-empty-text">
                Allocation and projected yield appear once your first position is confirmed on-chain.
                The minimum subscription is $250,000 USDC.
              </p>
            </div>
          </div>
        ) : null}

        {/* ── Yield model explanation ── */}
        <div className="pf-leaf-section">
          <div className="pf-leaf-section__card">
            <div className="pf-leaf-section__head">
              <h2 className="pf-leaf-section-title">Yield model</h2>
              <span className="pf-leaf-section-subtitle">How returns are generated</span>
            </div>
            <div className="pf-leaf-model-grid">
              <div className="pf-leaf-model-item">
                <span className="pf-leaf-model-item__label">Primary source</span>
                <span className="pf-leaf-model-item__value">Bitcoin mining revenue</span>
              </div>
              <div className="pf-leaf-model-item">
                <span className="pf-leaf-model-item__label">Distribution</span>
                <span className="pf-leaf-model-item__value">Monthly · USDC · T+5</span>
              </div>
              <div className="pf-leaf-model-item">
                <span className="pf-leaf-model-item__label">Target range</span>
                <span className="pf-leaf-model-item__value">
                  <ApyRange low={rLow} high={rHigh} className="tabular ct-text-accent font-semibold" />
                </span>
              </div>
              <div className="pf-leaf-model-item">
                <span className="pf-leaf-model-item__label">Methodology</span>
                <span className="pf-leaf-model-item__value">
                  {METHODOLOGY_VERSION.startsWith("v") ? METHODOLOGY_VERSION : `v${METHODOLOGY_VERSION}`}
                </span>
              </div>
              <div className="pf-leaf-model-item">
                <span className="pf-leaf-model-item__label">Soft lock-up</span>
                <span className="pf-leaf-model-item__value">60-day notice</span>
              </div>
              <div className="pf-leaf-model-item">
                <span className="pf-leaf-model-item__label">Structure</span>
                <span className="pf-leaf-model-item__value">Cayman SPV · Class A</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Proof strip ── */}
        {hasPositions && (
          <div className="pf-leaf-proof-strip">
            <ShieldCheck size={14} aria-hidden />
            <span>Underlying proof:</span>
            <span className={cn("pf-leaf-proof-status", data.source === "live" && "pf-leaf-proof-status--live")}>
              {data.source === "live" ? "Current" : "Pending"}
            </span>
            {data.updatedAt && (
              <span className="pf-leaf-proof-date">
                As of{" "}
                {new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                }).format(data.updatedAt)}
              </span>
            )}
          </div>
        )}

        {/* ── Disclaimer ── */}
        <p className="pf-leaf-disclaimer">
          Conditional projection — not guaranteed · Returns depend on mining revenue, network
          difficulty, and BTC price. Past performance does not indicate future results.
        </p>
      </div>
    </PortfolioLeafShell>
  );
}
