import {
  KycChartSurface,
  KycHeroKpiBand,
  KycPageTitle,
  KycPanel,
  KycSection,
} from "@/components/catalyst/kyc-page";

import {
  PreviewAllocationBars,
  PreviewLineChart,
  PreviewMaturityTimeline,
} from "./_components/chart-placeholders";
import {
  KycPreviewShell,
  PanelHeader,
  PanelRow,
  StatusBadge,
} from "./_components/kyc-preview-shell";
import {
  ALLOCATION_POCKETS,
  CONSTRUCTION_STEPS,
  HERO_STATUSES,
  KPI_METRICS,
  MATURITY_ROWS,
  RECEIPT_ROWS,
  RIGHT_RAIL,
  SERIES1,
} from "./_data/mock";

export const metadata = {
  title: "KYC Shell Preview · Hearst Bitcoin Reserve Vault — Series 1",
  description: "Isolated Series 1 investor cockpit shell — static preview only.",
};

export default function KycShellPreviewPage() {
  return (
    <KycPreviewShell>
      <div data-testid="kyc-shell-preview" className="flex flex-col gap-10">
        <section id="overview" className="scroll-mt-6">
          <KycPageTitle
            title={SERIES1.fullName}
            meta={`${SERIES1.ticker} · ${SERIES1.methodology}`}
            description={SERIES1.tagline}
          />
          <div className="mt-5 flex flex-wrap gap-2">
            {HERO_STATUSES.map((status) => (
              <StatusBadge key={status.label} label={status.label} tone={status.tone} />
            ))}
          </div>
        </section>

        <KycSection>
          <KycHeroKpiBand
            hero={{
              label: "Target BTC reserve",
              value: "42.50 BTC",
              hint: "BTC delivery at maturity — preview placeholder",
            }}
            metrics={KPI_METRICS.map((metric) => ({
              label: metric.label,
              value: metric.value,
              hint: metric.hint,
            }))}
          />
        </KycSection>

        <div className="grid gap-8 xl:grid-cols-12">
          <div className="flex flex-col gap-8 xl:col-span-8">
            <div id="reserve" className="scroll-mt-6">
            <KycSection
              index="01"
              title="Allocation B1 / B2 / B3"
              description="Target pocket split for reserve construction — contractual targets, preview only."
            >
              <div className="grid gap-5 lg:grid-cols-2">
                <KycPanel className="lg:col-span-2">
                  <PanelHeader title="Pocket allocation" meta="Target split" />
                  <div className="divide-y">
                    {ALLOCATION_POCKETS.map((pocket) => (
                      <PanelRow
                        key={pocket.code}
                        label={`${pocket.code} · ${pocket.label}`}
                        value={`${pocket.target} · ${pocket.amount}`}
                        hint={pocket.note}
                      />
                    ))}
                  </div>
                </KycPanel>

                <KycChartSurface
                  title="Allocation mix"
                  description="Stylized ring / bar placeholder for B1, B2 and B3."
                >
                  <PreviewAllocationBars />
                </KycChartSurface>

                <KycChartSurface
                  title="BTC reserve construction path"
                  description="Indexed accumulation register — preview placeholder."
                >
                  <PreviewLineChart className="min-h-44" />
                </KycChartSurface>
              </div>
            </KycSection>

            <KycSection
              index="02"
              title="BTC construction path"
              description="Phased reserve construction from mining power through maturity delivery."
            >
              <KycPanel>
                <PanelHeader title="Construction phases" meta="Preview timeline" />
                <div className="divide-y">
                  {CONSTRUCTION_STEPS.map((step) => (
                    <PanelRow
                      key={step.phase}
                      label={`${step.phase} · ${step.label}`}
                      value={step.status}
                      hint={step.detail}
                    />
                  ))}
                </div>
              </KycPanel>
            </KycSection>
            </div>

            <div id="maturity" className="scroll-mt-6">
            <KycSection
              index="03"
              title="Maturity & delivery"
              description="BTC delivery at maturity under smart-contract receipt — no periodic distribution."
            >
              <div className="grid gap-5 lg:grid-cols-2">
                <KycPanel>
                  <PanelHeader title="Maturity schedule" meta="Contractual" />
                  <div className="divide-y">
                    {MATURITY_ROWS.map((row) => (
                      <PanelRow key={row.label} label={row.label} value={row.value} />
                    ))}
                  </div>
                </KycPanel>

                <KycChartSurface title="Maturity timeline" description="Delivery horizon placeholder.">
                  <PreviewMaturityTimeline />
                </KycChartSurface>
              </div>
            </KycSection>
            </div>

            <div id="receipt" className="scroll-mt-6">
            <KycSection index="04" title="Smart contract receipt">
              <KycPanel>
                <PanelHeader title="On-chain receipt" meta="Preview hash" />
                <div className="divide-y">
                  {RECEIPT_ROWS.map((row) => (
                    <PanelRow key={row.label} label={row.label} value={row.value} />
                  ))}
                </div>
              </KycPanel>
            </KycSection>
            </div>
          </div>

          <aside id="proof" className="scroll-mt-6 xl:col-span-4">
            <div className="flex flex-col gap-5 xl:sticky xl:top-6">
              <KycPanel>
                <PanelHeader title="Proof & provenance" meta="Preview" />
                <ul className="space-y-3 px-5 py-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  {RIGHT_RAIL.proof.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </KycPanel>

              <KycPanel>
                <PanelHeader title="Risk controls" />
                <ul className="space-y-3 px-5 py-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  {RIGHT_RAIL.risk.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-zinc-400" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </KycPanel>

              <KycPanel>
                <PanelHeader title="Operator notes" />
                <ul className="space-y-3 px-5 py-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  {RIGHT_RAIL.operator.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </KycPanel>

              <KycPanel className="border-emerald-500/20 bg-emerald-500/5 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Product guardrails
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-200">
                  No periodic distribution. BTC reserve construction with delivery at maturity only.
                  This shell preview carries no live positions or operator data.
                </p>
              </KycPanel>
            </div>
          </aside>
        </div>
      </div>
    </KycPreviewShell>
  );
}
