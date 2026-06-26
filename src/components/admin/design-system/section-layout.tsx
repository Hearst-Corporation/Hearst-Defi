import { Card } from "@/components/ui/card";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import { Metric } from "@/components/ui/metric";
import { MetricGrid } from "@/components/ui/nested-panel";

import { DsBlock, DsExampleTag, DsSection, DsSpecimen } from "./ds-kit";

export function SectionLayout() {
  return (
    <DsSection
      id="layout"
      index="B"
      title="Layout primitives"
      lead="How a page breathes. The 3-column shell is fixed chrome with a fluid centre; inside the centre, panels sit on a token-based grid. Let pages reflow — never force widths or heights."
    >
      <div className="admin-doc-inline-row--start admin-doc-inline-row">
        <DsExampleTag label="All values are illustrative — not real product data" />
      </div>

      <DsBlock title="3-column shell" hint="Fixed rail · fluid centre · preset chat">
        <div className="ds-schema" role="img" aria-label="Three column cockpit shell: 104px left rail, fluid centre, 352px chat rail">
          <div className="ds-schema__zone">
            <span className="ds-schema__label">Rail</span>
            <span className="ds-schema__dim">104px</span>
          </div>
          <div className="ds-schema__zone">
            <span className="ds-schema__label">Centre</span>
            <span className="ds-schema__dim">flex · min-width 0</span>
          </div>
          <div className="ds-schema__zone">
            <span className="ds-schema__label">Chat</span>
            <span className="ds-schema__dim">352px</span>
          </div>
        </div>
        <p className="body-xs ct-text-muted m-0">
          The left rail is locked at 104px and the chat offers 48 / 352 / 420px
          presets. Only the centre absorbs width. Chat hides ≤1199px; the rail
          collapses to a 56px bottom bar ≤900px.
        </p>
      </DsBlock>

      <DsBlock title="Admin page shell" hint=".admin-doc-shell + AdminPageHeader">
        <DsSpecimen caption="Page header → rule → content stack" classHint=".admin-page-header">
          <div className="w-full admin-doc-stack--tight">
            <p className="eyebrow">Strategy</p>
            <p className="h2 m-0">
              Product <span className="h1-accent">Workspace</span>
            </p>
            <div className="page-canon-rule" aria-hidden="true" />
            <p className="body-sm ct-text-muted m-0">
              Every admin page opens with AdminPageHeader (titleLead + titleAccent
              + contextLabel), a hairline rule, then a vertical content stack.
            </p>
          </div>
        </DsSpecimen>
      </DsBlock>

      <DsBlock title="Panel grid" hint="Auto-fit columns reflow at every viewport">
        <div className="ds-grid--two ds-grid">
          {["Allocation", "Distributions"].map((title) => (
            <Card key={title} hoverOverlay={false}>
              <DashboardPanelHeader title={title} tone="quiet" />
              <p className="body-sm ct-text-muted m-0">
                Cockpit panel — Card (.ct-glass-panel). Panels share one grid; the
                column count is driven by available width, not hard-coded.
              </p>
            </Card>
          ))}
        </div>
      </DsBlock>

      <DsBlock title="Split panel" hint="Two balanced columns inside one surface">
        <Card hoverOverlay={false}>
          <div className="ds-grid--two ds-grid">
            <div className="admin-doc-stack--tight">
              <p className="stat-label ct-text-muted m-0">Left column</p>
              <p className="body-sm ct-text-body m-0">
                Use a 2-column grid for paired content (form ↔ preview, summary ↔
                detail). It collapses to a single column on narrow viewports.
              </p>
            </div>
            <div className="admin-doc-stack--tight">
              <p className="stat-label ct-text-muted m-0">Right column</p>
              <p className="body-sm ct-text-body m-0">
                No nested glass surfaces here — the parent Card owns the material,
                the columns are layout-only.
              </p>
            </div>
          </div>
        </Card>
      </DsBlock>

      <DsBlock title="Compact instrument layout" hint="Dense KPI grid — MetricGrid + nested metrics">
        <Card hoverOverlay={false} material="flat">
          <DashboardPanelHeader title="Vault signals" tone="quiet" />
          <MetricGrid columns={4}>
            <Metric variant="nested" label="NAV" value="$12.40M" sublabel="USDC" />
            <Metric variant="nested" label="Investors" value="48" />
            <Metric variant="nested" label="Lock-up" value="60d" />
            <Metric variant="nested" label="Status" value="Open" />
          </MetricGrid>
        </Card>
      </DsBlock>

      <DsBlock title="Full-width section" hint="One row, edge to edge of the centre column">
        <Card hoverOverlay={false}>
          <div className="admin-doc-inline-row--between admin-doc-inline-row">
            <div className="admin-doc-stack--compact">
              <p className="stat-label ct-text-muted m-0">Full-width band</p>
              <p className="body-sm ct-text-body m-0">
                Spans the whole content column — for hero summaries or toolbars.
              </p>
            </div>
          </div>
        </Card>
      </DsBlock>
    </DsSection>
  );
}
