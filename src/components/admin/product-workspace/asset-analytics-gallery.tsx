"use client";

/**
 * Asset Analytics — canonical investor chart variants (PROMPT 234).
 * Demo data only; documents tokens, series, and recommended usage.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/catalyst/card";
import { AccumulationChartPanel } from "@/features/investor-ui/components/accumulation-chart-panel";
import { SourcesAccumulationPanel } from "@/features/investor-ui/components/sources-accumulation-panel";
import { StrategyCompositionPanel } from "@/features/investor-ui/components/strategy-composition-panel";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";
import { ASSET_TOKEN } from "@/lib/ds/asset-tokens";
import type { AllocationPocketViewModel } from "@/features/investor-ui/types/dashboard";

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

const TOKEN_ROWS = [
  { domain: "Bitcoin", token: "--ct-asset-btc", usage: "BTC series, hero accent, accumulation area" },
  { domain: "USDC", token: "--ct-asset-usdc", usage: "Operating reserve, capacity bar, runway" },
  { domain: "Mining", token: "--ct-asset-mining", usage: "Mining power pocket, production bars" },
  { domain: "Live / Healthy", token: "--ct-status-success", usage: "Fleet active, healthy reserve status" },
  { domain: "Neutral", token: "--ct-chart-neutral", usage: "Reference paths, idle segments" },
] as const;

export function AssetAnalyticsGallery() {
  return (
    <section className="flex flex-col gap-(--ct-space-5)">
      <header className="flex flex-col gap-(--ct-space-1)">
        <h2 className="text-[length:var(--ct-text-2xl)] font-semibold tracking-tight ct-text-strong">
          Asset <span className="text-[var(--ct-asset-btc)]">Analytics</span>
        </h2>
        <p className="ct-metric-caption ct-text-muted">
          Investor dashboard primitives · tokens via <code className="mono">ASSET_TOKEN</code> · reduced motion respected
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Asset icons</CardTitle>
          <CardDescription>BTC / USDC / mining / reserve — shared across Dashboard and Bitcoin</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-(--ct-space-6)">
          {(["btc", "usdc", "mining", "reserve"] as const).map((v) => (
            <div key={v} className="flex flex-col items-center gap-(--ct-space-2)">
              <AssetIcon variant={v} size="lg" />
              <span className="body-xs ct-text-muted capitalize">{v}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-(--ct-space-5) lg:grid-cols-2 items-start">
        <AccumulationChartPanel
          points={DEMO_ACCUMULATION}
          currentMonth={6}
          totalMonths={24}
          provenance="estimated"
        />
        <SourcesAccumulationPanel monthlyProduction={DEMO_SOURCES} />
      </div>

      <div className="grid gap-(--ct-space-5) lg:grid-cols-2 items-start">
        <StrategyCompositionPanel pockets={DEMO_POCKETS} provenance="estimated" />
        <Card>
          <CardHeader>
            <CardTitle>Semantic tokens</CardTitle>
            <CardDescription>Single source in cockpit.css — import ASSET_TOKEN in components</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full body-xs">
              <thead>
                <tr className="ct-text-muted text-left border-b border-[var(--ct-border-soft)]">
                  <th className="pb-2 pr-4 font-medium">Domain</th>
                  <th className="pb-2 pr-4 font-medium">Token</th>
                  <th className="pb-2 font-medium">Usage</th>
                </tr>
              </thead>
              <tbody>
                {TOKEN_ROWS.map((row) => (
                  <tr key={row.token} className="border-b border-[var(--ct-border-soft)]">
                    <td className="py-2 pr-4 ct-text-strong">{row.domain}</td>
                    <td className="py-2 pr-4 mono text-[var(--ct-asset-usdc)]">{row.token}</td>
                    <td className="py-2 ct-text-muted">{row.usage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="body-xs ct-text-faint mt-(--ct-space-4) m-0">
              Runtime refs: btc={ASSET_TOKEN.btc}, usdc={ASSET_TOKEN.usdc}, mining={ASSET_TOKEN.mining}
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
