/**
 * KYC shell preview — Hearst Bitcoin Reserve Vault, Series 1.
 *
 * This is a STRUCTURAL PORT of the real KYC surface (`src/app/(product)/
 * dashboard/page.tsx`), not a reinterpretation: same Kyc* primitives, same
 * section order and indices, same 12-column grid splits (8/4, 7/5, 2-up),
 * same panel idioms (bordered header strip + divided dl), same chart
 * components (AccumulationChartSignature, ReserveRunwayChart,
 * MiningActivityTimeline) and the same closing disclaimer.
 *
 * Only the data source differs: every value comes from the static `_data/mock`
 * module. No fetch, no API, no Prisma, no RPC, no wallet, no auth.
 */

import {
  KycChartSurface,
  KycEmptyChart,
  KycHeroKpiBand,
  KycPageTitle,
  KycPanel,
  KycSection,
} from "@/components/catalyst/kyc-page";
import { AccumulationChartSignature } from "@/features/investor-ui/components/accumulation-chart-signature";
import {
  MiningActivityTimeline,
  ReserveRunwayChart,
} from "@/features/investor-ui/components/reserve-cockpit";

import {
  ACCUMULATION_POINTS,
  ALLOCATION_POCKETS,
  CAPITAL_FLOW_STEPS,
  FOOTER_NOTE,
  HERO,
  KPI_METRICS,
  MINING_INTERVALS,
  PROOF_ROWS,
  RUNWAY_DATA,
  SERIES1,
  STRATEGY_SIGNALS,
  TERM,
  VERDICT_DETAIL,
} from "./_data/mock";

export const metadata = {
  title: "KYC Shell Preview · Hearst Bitcoin Reserve Vault — Series 1",
  description: "Structural preview of the Series 1 investor cockpit — static data only.",
};

export default function KycShellPreviewPage() {
  return (
    <div data-testid="kyc-shell-preview" className="flex flex-col gap-10">
      <KycPageTitle title={SERIES1.fullName} meta={SERIES1.meta} description={SERIES1.description} />

      <KycSection>
        <KycHeroKpiBand
          hero={{ label: HERO.label, value: HERO.value, hint: HERO.hint }}
          metrics={KPI_METRICS.map((metric) => ({
            label: metric.label,
            value: metric.value,
            hint: metric.hint,
          }))}
        />
      </KycSection>

      <KycSection
        index="01"
        title="Bitcoin accumulation"
        description="Accumulated BTC is the principal investor outcome. Market price is contextual only; it is not a return projection."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <KycChartSurface
            className="lg:col-span-8"
            title="Accumulated BTC through the term"
            description="Mining credits indexed from the program ledger."
          >
            <AccumulationChartSignature
              points={ACCUMULATION_POINTS}
              currentMonth={TERM.currentMonth}
              totalMonths={TERM.totalMonths}
              provenance="simulated"
            />
          </KycChartSurface>
          <KycPanel className="lg:col-span-4">
            <div className="border-b border-zinc-950/8 px-5 py-4 dark:border-white/10">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                Position summary
              </p>
            </div>
            <dl className="divide-y divide-zinc-950/8 px-5 dark:divide-white/10">
              {STRATEGY_SIGNALS.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 py-4">
                  <dt className="text-sm text-zinc-500 dark:text-zinc-400">{label}</dt>
                  <dd className="text-sm font-semibold text-zinc-950 dark:text-white">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="px-5 py-4 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{VERDICT_DETAIL}</p>
          </KycPanel>
        </div>
      </KycSection>

      <KycSection
        index="02"
        title="Capital architecture"
        description="Capital is governed by the Series 1 policy allocation: B1 Mining Power, B2 BTC Pouch and B3 Reserve USDC."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <KycPanel className="lg:col-span-7">
            <div className="border-b border-zinc-950/8 px-5 py-4 dark:border-white/10">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                Policy allocation
              </p>
            </div>
            <div className="space-y-5 p-5">
              {ALLOCATION_POCKETS.map((pocket) => (
                <div key={pocket.pocket}>
                  <div className="flex items-baseline justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                        {pocket.pocket} · {pocket.label}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Target allocation</p>
                    </div>
                    <span className="text-lg font-semibold tabular-nums text-zinc-950 dark:text-white">
                      {pocket.pct}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${pocket.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </KycPanel>
          <KycPanel className="lg:col-span-5">
            <div className="border-b border-zinc-950/8 px-5 py-4 dark:border-white/10">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                Capital flow
              </p>
            </div>
            <ol className="divide-y divide-zinc-950/8 px-5 dark:divide-white/10">
              {CAPITAL_FLOW_STEPS.map((step, index) => (
                <li key={step} className="flex items-center gap-4 py-4">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/12 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm font-medium text-zinc-950 dark:text-white">{step}</span>
                </li>
              ))}
            </ol>
          </KycPanel>
        </div>
      </KycSection>

      <KycSection
        index="03"
        title="Operations, reserve & proof"
        description="Operational reports are kept separate from the investor outcome so every number retains its source and meaning."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <KycChartSurface
            title="All-in acquisition cost vs BTC spot"
            description="A comparison becomes available when cost and spot observations have both resolved."
          >
            <KycEmptyChart
              label="Cost history is not available yet"
              detail="No cost and spot observation pair has resolved for the current reporting window."
            />
          </KycChartSurface>
          <KycChartSurface
            title="Reserve runway"
            description="Electricity coverage funded by B3 Reserve USDC."
          >
            <ReserveRunwayChart data={RUNWAY_DATA} source="mock" />
          </KycChartSurface>
          <KycChartSurface
            title="Mining activity"
            description="Active and curtailed fleet state in the current reporting window."
          >
            <MiningActivityTimeline intervals={MINING_INTERVALS} source="mock" />
          </KycChartSurface>
          <KycPanel>
            <div className="border-b border-zinc-950/8 px-5 py-4 dark:border-white/10">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                Proof &amp; contract status
              </p>
            </div>
            <dl className="divide-y divide-zinc-950/8 px-5 dark:divide-white/10">
              {PROOF_ROWS.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 py-4">
                  <dt className="text-sm text-zinc-500 dark:text-zinc-400">{label}</dt>
                  <dd className="text-sm font-semibold text-zinc-950 dark:text-white">{value}</dd>
                </div>
              ))}
            </dl>
          </KycPanel>
        </div>
      </KycSection>

      <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">{FOOTER_NOTE}</p>
    </div>
  );
}
