"use client";

/**
 * Asset Analytics — canonical investor chart variants (PROMPT 234).
 *
 * Demo data only. This is a gallery of the investor dashboard chart primitives
 * rendered with fixture values, so the whole surface carries the honest
 * "estimated / simulated" provenance the real components expose. It documents
 * the semantic tokens, series colours, and recommended usage in one place.
 *
 * Colour law (Hearst): one green — `--ct-accent` — reserved for Live/healthy
 * state only; BTC/USDC/mining carry their own asset tokens; everything else is
 * neutral graphite. No red anywhere; no hard-coded hex. Numeric cells are
 * tabular. Demo values below are intentionally fixed and must not be changed.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/catalyst/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { AccumulationChartPanel } from "@/features/investor-ui/components/accumulation-chart-panel";
import { SourcesAccumulationPanel } from "@/features/investor-ui/components/sources-accumulation-panel";
import { StrategyCompositionPanel } from "@/features/investor-ui/components/strategy-composition-panel";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";
import { ASSET_TOKEN } from "@/lib/ds/asset-tokens";
import type { AllocationPocketViewModel } from "@/features/investor-ui/types/dashboard";
import type { ReactNode } from "react";

const DEMO_ACCUMULATION = [
  { period: "2026-01", cumulativeBtc: 0.042, miningBtc: 0.036 },
  { period: "2026-02", cumulativeBtc: 0.088, miningBtc: 0.075 },
  { period: "2026-03", cumulativeBtc: 0.135, miningBtc: 0.115 },
  { period: "2026-04", cumulativeBtc: 0.182, miningBtc: 0.155 },
  { period: "2026-05", cumulativeBtc: 0.228, miningBtc: 0.194 },
  { period: "2026-06", cumulativeBtc: 0.276, miningBtc: 0.234 },
];

const DEMO_SOURCES = DEMO_ACCUMULATION.map((p) => ({
  period: p.period,
  mining: p.miningBtc,
  strategic: Math.max(0, p.cumulativeBtc - p.miningBtc),
}));

const DEMO_POCKETS: readonly AllocationPocketViewModel[] = [
  { pocket: "B1", label: "Mining Power", targetBps: 4000, actualBps: 3960 },
  { pocket: "B2", label: "BTC Pouch", targetBps: 2700, actualBps: 2740 },
  { pocket: "B3", label: "Reserve", targetBps: 3300, actualBps: 3300 },
];

const ASSET_TILES = [
  { variant: "btc", label: "Bitcoin", token: "--ct-asset-btc" },
  { variant: "usdc", label: "USDC", token: "--ct-asset-usdc" },
  { variant: "mining", label: "Mining", token: "--ct-asset-mining" },
  { variant: "reserve", label: "Reserve", token: "--ct-asset-reserve" },
] as const;

const TOKEN_ROWS = [
  { domain: "Bitcoin", token: "--ct-asset-btc", swatch: ASSET_TOKEN.btc, usage: "BTC series, hero accent, accumulation area" },
  { domain: "USDC", token: "--ct-asset-usdc", swatch: ASSET_TOKEN.usdc, usage: "Operating reserve, capacity bar, runway" },
  { domain: "Mining", token: "--ct-asset-mining", swatch: ASSET_TOKEN.mining, usage: "Mining power pocket, production bars" },
  { domain: "Live / Healthy", token: "--ct-status-success", swatch: ASSET_TOKEN.live, usage: "Fleet active, healthy reserve — the single green" },
  { domain: "Neutral", token: "--ct-chart-neutral", swatch: ASSET_TOKEN.neutral, usage: "Reference paths, idle segments" },
] as const;

/** Small labelled band that gives the flat card stack a legible rhythm. */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-(--ct-space-3)">
      <span className="ct-bento-label whitespace-nowrap">{children}</span>
      <span aria-hidden className="h-px flex-1 bg-[var(--ct-border-soft)]" />
    </div>
  );
}

export function AssetAnalyticsGallery() {
  return (
    <section className="flex flex-col gap-7">
      <header className="flex flex-col gap-(--ct-space-2)">
        <span className="ct-bento-label" style={{ color: ASSET_TOKEN.btc }}>Investor primitives</span>
        <h2 className="text-[length:var(--ct-text-2xl)] font-semibold tracking-tight ct-text-strong m-0">
          Asset <span style={{ color: ASSET_TOKEN.btc }}>Analytics</span>
        </h2>
        <p className="ct-metric-caption ct-text-muted m-0">
          Dashboard chart variants · tokens via <code className="mono">ASSET_TOKEN</code> · reduced motion respected
        </p>
        <span className="mt-(--ct-space-1) inline-flex w-fit items-center gap-(--ct-space-2) rounded-md border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] px-(--ct-space-3) py-(--ct-space-1)">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--color-chart-neutral)]" />
          <span className="body-xs text-[var(--ct-text-faint)]">Demo data — illustrative, carries estimated / simulated provenance</span>
        </span>
      </header>

      {/* Foundations — the shared asset iconography */}
      <div className="flex flex-col gap-(--ct-space-4)">
        <SectionLabel>Foundations</SectionLabel>
        <Card>
          <CardHeader>
            <CardTitle>Asset icons</CardTitle>
            <CardDescription>BTC / USDC / mining / reserve — shared across Dashboard and Bitcoin</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-(--ct-space-3) sm:grid-cols-4">
              {ASSET_TILES.map((tile) => (
                <div
                  key={tile.variant}
                  className="flex flex-col items-center justify-center gap-(--ct-space-3) rounded-md border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] px-(--ct-space-4) py-(--ct-space-5)"
                >
                  <AssetIcon variant={tile.variant} size="lg" />
                  <div className="flex flex-col items-center gap-(--ct-space-1)">
                    <span className="body-xs ct-text-strong">{tile.label}</span>
                    <span className="mono text-[length:var(--ct-text-nano)] text-[var(--ct-text-faint)]">{tile.token}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accumulation — the two time-series primitives, side by side */}
      <div className="flex flex-col gap-(--ct-space-4)">
        <SectionLabel>Accumulation over time</SectionLabel>
        <div className="grid gap-(--ct-space-5) lg:grid-cols-2 items-start">
          <AccumulationChartPanel
            points={DEMO_ACCUMULATION}
            currentMonth={6}
            totalMonths={24}
            provenance="estimated"
          />
          <SourcesAccumulationPanel monthlyProduction={DEMO_SOURCES} />
        </div>
      </div>

      {/* Composition & tokens — the donut split and the token legend */}
      <div className="flex flex-col gap-(--ct-space-4)">
        <SectionLabel>Composition &amp; tokens</SectionLabel>
        <div className="grid gap-(--ct-space-5) lg:grid-cols-2 items-start">
          <StrategyCompositionPanel pockets={DEMO_POCKETS} provenance="estimated" />
          <Card>
            <CardHeader>
              <CardTitle>Semantic tokens</CardTitle>
              <CardDescription>Single source in cockpit.css — import ASSET_TOKEN in components</CardDescription>
            </CardHeader>
            <CardContent>
              <Table className="w-full body-xs">
                <TableHead>
                  <TableRow className="ct-text-muted text-left">
                    <TableHeader>Domain</TableHeader>
                    <TableHeader>Token</TableHeader>
                    <TableHeader>Usage</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {TOKEN_ROWS.map((row) => (
                    <TableRow key={row.token}>
                      <TableCell>
                        <span className="flex items-center gap-(--ct-space-2)">
                          <span
                            aria-hidden
                            className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-[var(--ct-border-soft)]"
                            style={{ backgroundColor: row.swatch }}
                          />
                          <span className="ct-text-strong whitespace-nowrap">{row.domain}</span>
                        </span>
                      </TableCell>
                      <TableCell className="mono ct-text-muted whitespace-nowrap">{row.token}</TableCell>
                      <TableCell className="ct-text-muted">{row.usage}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mono text-[length:var(--ct-text-nano)] text-[var(--ct-text-faint)] tabular-nums mt-(--ct-space-4) m-0">
                Runtime refs · btc={ASSET_TOKEN.btc} · usdc={ASSET_TOKEN.usdc} · mining={ASSET_TOKEN.mining}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
