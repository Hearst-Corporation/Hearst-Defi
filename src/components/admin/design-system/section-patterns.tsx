import { ApyRange } from "@/components/catalyst/apy-range";
import { Card } from "@/components/catalyst/card";
import { DashboardPanelHeader } from "@/components/catalyst/dashboard-panel-header";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { Metric } from "@/components/catalyst/metric";
import { DataRow, MetricGrid, NestedPanel } from "@/components/catalyst/nested-panel";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";

import { DsBlock, DsExampleTag, DsSection, DsSpecimen } from "./ds-kit";

const ACTIVITY = [
  { date: "Jun 01", event: "USDC distribution", amount: "+$4,200" },
  { date: "May 28", event: "Deposit confirmed", amount: "+$250,000" },
  { date: "May 01", event: "USDC distribution", amount: "+$4,050" },
] as const;

export function SectionPatterns() {
  return (
    <DsSection
      id="patterns"
      index="D"
      title="Financial & product patterns"
      lead="Composed patterns for the investor cockpit and admin. The values below are placeholder documentation values — every block is labelled “Design System example”, never confused with real product data."
    >
      <div className="admin-doc-inline-row--start admin-doc-inline-row">
        <DsExampleTag label="All values are illustrative — not real product data" />
      </div>

      <DsBlock title="KPI card" hint="Metric (premium) — value, provenance, trend">
        <div className="ds-grid--two ds-grid">
          <DsSpecimen caption="Net APY" example>
            <Metric
              label="Net APY"
              value={<ApyRange low={9.4} high={12.8} />}
              provenance="estimated"
              trend={{ direction: "up", text: "+0.4" }}
              sublabel="trailing 30d"
              className="w-full"
            />
          </DsSpecimen>
          <DsSpecimen caption="Distributions paid" example>
            <Metric
              label="Distributions"
              value="$48,200"
              provenance="attested"
              sublabel="since inception"
              className="w-full"
            />
          </DsSpecimen>
        </div>
      </DsBlock>

      <DsBlock
        title="Metric — premium composition"
        hint="Accent green, but controlled: the figure + a real-data signal, nothing else green"
      >
        <div className="ds-grid--two ds-grid">
          <DsSpecimen caption="Live NAV — accent earned by real data" example>
            <Metric
              label="Net asset value"
              value={<span className="stat-value">$12.40M</span>}
              provenance="live"
              trend={{ direction: "up", text: "+4.2% MTD" }}
              sublabel="updated continuously"
              className="w-full"
            />
          </DsSpecimen>
          <DsSpecimen caption="Projected APY — neutral provenance" example>
            <Metric
              label="Target APY"
              value={<ApyRange low={8.0} high={15.0} className="stat-value" />}
              provenance="estimated"
              sublabel="range, not guaranteed"
              className="w-full"
            />
          </DsSpecimen>
        </div>
      </DsBlock>

      <DsBlock title="Compact portfolio metrics" hint="MetricGrid + nested metrics inside one panel">
        <DsSpecimen caption="Vault summary strip" example stack>
          <Card hoverOverlay={false} material="flat" className="w-full">
            <MetricGrid columns={4}>
              <Metric variant="nested" label="NAV" value="$12.40M" sublabel="USDC" />
              <Metric variant="nested" label="Net APY" value="9.4–12.8%" />
              <Metric variant="nested" label="Investors" value="48" />
              <Metric variant="nested" label="Lock-up" value="60d" />
            </MetricGrid>
          </Card>
        </DsSpecimen>
      </DsBlock>

      <DsBlock title="Status rail" hint="Dot-only provenance on a black strip">
        <DsSpecimen caption="Trust strip" example stack>
          <div className="admin-doc-inline-row--loose admin-doc-inline-row w-full">
            {(["live", "oracle", "attested", "estimated", "stale"] as const).map((kind) => (
              <span key={kind} className="admin-doc-inline-row--micro admin-doc-inline-row">
                <ProvenanceBadge kind={kind} variant="strip" />
                <span className="body-xs ct-text-muted capitalize">{kind}</span>
              </span>
            ))}
          </div>
        </DsSpecimen>
      </DsBlock>

      <DsBlock title="Position card" hint="Vault name, APY range, value, provenance">
        <DsSpecimen caption="Open position" example stack>
          <Card hoverOverlay={false} className="w-full">
            <div className="admin-doc-inline-row--between admin-doc-inline-row">
              <div className="admin-doc-stack--compact">
                <p className="h4 ct-text-strong m-0">Hearst Yield Vault</p>
                <p className="body-xs ct-text-muted m-0">Cayman SPV · monthly USDC</p>
              </div>
              <ProvenanceBadge kind="attested" />
            </div>
            <NestedPanel className="mt-[var(--ct-space-3)]">
              <DataRow label="Position value">$262,400</DataRow>
              <DataRow label="Target APY">
                <ApyRange low={9.4} high={12.8} />
              </DataRow>
            </NestedPanel>
          </Card>
        </DsSpecimen>
      </DsBlock>

      <DsBlock title="Activity row & financial list" hint="Flat list rows, tabular amounts">
        <DsSpecimen caption="Recent activity" example stack>
          <Card hoverOverlay={false} material="flat" className="w-full">
            <DashboardPanelHeader title="Recent activity" tone="quiet" />
            <div className="admin-doc-stack--flat">
              {ACTIVITY.map((row) => (
                <div
                  key={row.date}
                  className="admin-doc-table-row admin-doc-inline-row--between admin-doc-inline-row py-[var(--ct-space-2)]"
                >
                  <span className="body-xs ct-text-faint mono">{row.date}</span>
                  <span className="body-sm ct-text-body flex-1 min-w-0">{row.event}</span>
                  <span className="body-sm ct-text-strong mono tabular">{row.amount}</span>
                </div>
              ))}
            </div>
          </Card>
        </DsSpecimen>
      </DsBlock>

      <DsBlock title="Proof status row" hint="ProofRow + provenance — evidence inside an active card">
        <DsSpecimen caption="Proof of reserve" example stack>
          <Card hoverOverlay={false} material="flat" className="w-full">
            <div className="admin-doc-inline-row--between admin-doc-inline-row">
              <p className="h4 ct-text-strong m-0">Reserve attestation</p>
              <ProvenanceBadge kind="oracle" />
            </div>
            <NestedPanel className="mt-[var(--ct-space-3)]">
              <DataRow label="Coverage ratio">104.2%</DataRow>
              <DataRow label="Attested at">2026-06-01 00:00 UTC</DataRow>
              <DataRow label="Evidence">0x7c…12f</DataRow>
            </NestedPanel>
          </Card>
        </DsSpecimen>
      </DsBlock>

      <DsBlock title="Empty states" hint="Honest placeholders — no fake live / verified badges">
        <div className="ds-grid--two ds-grid">
          <DsSpecimen caption="Payout empty state" example stack>
            <EmptySurface
              message="No payouts scheduled"
              detail="Monthly USDC distributions appear once the vault is funded."
            />
          </DsSpecimen>
          <DsSpecimen caption="Allocation empty state" example stack>
            <EmptySurface
              message="Allocation pending"
              detail="Position weights publish after the first rebalance."
            />
          </DsSpecimen>
        </div>
      </DsBlock>

      <DsBlock title="Small chart container" hint="Bounded — never a hero-sized chart that forces height">
        <DsSpecimen caption="Chart frame" example stack>
          <Card hoverOverlay={false} className="w-full">
            <DashboardPanelHeader title="NAV trend" tone="quiet" provenance="estimated" />
            <div className="h-[var(--ct-space-24)]">
              <EmptySurface
                variant="chart"
                message="Chart renders here at a bounded height"
                detail="Containers cap the chart; they never let it expand to fill the page."
              />
            </div>
            <p className="body-xs ct-text-faint m-0 mt-[var(--ct-space-2)]">
              Projection — not guaranteed. Assumptions shown on the source widget.
            </p>
          </Card>
        </DsSpecimen>
      </DsBlock>

      <DsBlock
        title="Chart language"
        hint="--ct-chart-curve-color stroke + --ct-chart-area-top/bottom wash · static DS specimen"
      >
        <DsSpecimen caption="Curve + area fill" example stack>
          <Card hoverOverlay={false} className="w-full">
            <DashboardPanelHeader title="Trend shape" tone="quiet" />
            <svg
              className="ds-chart-specimen"
              viewBox="0 0 320 120"
              preserveAspectRatio="none"
              role="img"
              aria-label="Illustrative upward trend curve — design system specimen, not real data"
            >
              <defs>
                <linearGradient id="ds-curve-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--ct-chart-area-top)" />
                  <stop offset="100%" stopColor="var(--ct-chart-area-bottom)" />
                </linearGradient>
              </defs>
              <path
                d="M 0 92 C 24 90, 40 82, 64 84 S 104 70, 128 64 S 168 58, 192 44 S 232 40, 256 28 S 296 18, 320 12 L 320 120 L 0 120 Z"
                fill="url(#ds-curve-area)"
                stroke="none"
              />
              <path
                d="M 0 92 C 24 90, 40 82, 64 84 S 104 70, 128 64 S 168 58, 192 44 S 232 40, 256 28 S 296 18, 320 12"
                fill="none"
                stroke="var(--ct-chart-curve-color)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              <circle cx="320" cy="12" r="3.5" fill="var(--ct-accent)" />
            </svg>
            <p className="body-xs ct-text-faint m-0 mt-[var(--ct-space-2)]">
              Static specimen — no axes, no data. Real charts consume the same three
              tokens so a curve restyle stays a one-token change.
            </p>
          </Card>
        </DsSpecimen>
      </DsBlock>
    </DsSection>
  );
}
