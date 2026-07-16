import { Bell, Plus, Search, Settings2 } from "lucide-react";

import { BentoBadge as Badge } from "@/components/catalyst/bento-badge";
import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
import { Card } from "@/components/catalyst/card";
import { DashboardPanelHeader } from "@/components/catalyst/dashboard-panel-header";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { TextField } from "@/components/catalyst/field";
import { DataRow, NestedPanel, ProofRow } from "@/components/catalyst/nested-panel";
import { PanelStatus } from "@/components/catalyst/panel-status";
import { Select } from "@/components/catalyst/select";
import { Textarea } from "@/components/catalyst/textarea";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Skeleton } from "@/components/catalyst/skeleton";

import { DsBlock, DsSection, DsSpecimen } from "./ds-kit";
import { DsTabsDemo } from "./ds-tabs-demo";

export function SectionComponents() {
  return (
    <DsSection
      id="components"
      index="C"
      title="Core components"
      lead="The approved primitives in src/components/ui. Reuse these — never re-implement a button, badge, card or empty state inline."
    >
      <DsBlock title="Buttons" hint="primary · secondary · ghost · danger · sizes · disabled">
        <DsSpecimen caption="Variants" classHint="<Button variant size />">
          <Button variant="primary" size="md">Primary</Button>
          <Button variant="secondary" size="md">Secondary</Button>
          <Button variant="ghost" size="md">Ghost</Button>
          <Button variant="danger" size="md">Danger</Button>
          <Button variant="secondary" size="md" disabled>
            Disabled
          </Button>
        </DsSpecimen>
        <DsSpecimen caption="Sizes" classHint='size="sm | md | lg"'>
          <Button variant="secondary" size="sm">
            Small
          </Button>
          <Button variant="secondary" size="md">
            Medium
          </Button>
          <Button variant="secondary" size="lg">
            Large
          </Button>
        </DsSpecimen>
      </DsBlock>

      <DsBlock title="Icon buttons" hint="Square ghost button + Lucide icon, aria-label required">
        <DsSpecimen caption="Icon-only actions">
          {[
            { icon: Search, label: "Search" },
            { icon: Bell, label: "Notifications" },
            { icon: Settings2, label: "Settings" },
            { icon: Plus, label: "Add" },
          ].map(({ icon: Icon, label }) => (
            <Button
              key={label}
              variant="ghost"
              size="md"
              aria-label={label}
              className="h-7 w-7 p-0"
            >
              <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
            </Button>
          ))}
        </DsSpecimen>
      </DsBlock>

      <DsBlock title="Badges & chips" hint="<Badge variant /> — status by colour, never a second green">
        <DsSpecimen caption="Badge variants">
          <Badge>Default</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="danger">Danger</Badge>
          <Badge variant="accent">Accent</Badge>
          <Badge variant="brand">Brand</Badge>
        </DsSpecimen>
      </DsBlock>

      <DsBlock title="Status pills — provenance" hint="Every metric carries one (non-negotiable #2)">
        <DsSpecimen caption="ProvenanceBadge — full pill">
          <ProvenanceBadge kind="live" />
          <ProvenanceBadge kind="oracle" />
          <ProvenanceBadge kind="attested" />
          <ProvenanceBadge kind="estimated" />
          <ProvenanceBadge kind="manual" />
          <ProvenanceBadge kind="stale" />
          <ProvenanceBadge kind="simulated" />
        </DsSpecimen>
      </DsBlock>

      <DsBlock title="Cards & panels" hint="Card (glass) · Card flat · NestedPanel">
        <div className="ds-grid--two ds-grid">
          <DsSpecimen caption="Glass card with header" example stack>
            <Card hoverOverlay={false} className="w-full">
              <DashboardPanelHeader
                title="Reserve coverage"
                tone="quiet"
                provenance="attested"
              />
              <p className="body-sm ct-text-muted m-0">
                The default module surface. A header sets the title and the trust
                strip; body content follows.
              </p>
            </Card>
          </DsSpecimen>
          <DsSpecimen caption="Nested evidence panel" example stack>
            <Card hoverOverlay={false} material="flat" density="compact" className="w-full">
              <NestedPanel>
                <DataRow label="Coverage ratio">104.2%</DataRow>
                <DataRow label="Attested at">2026-06-01 UTC</DataRow>
                <ProofRow label="Evidence">0x7c…12f</ProofRow>
              </NestedPanel>
              <p className="body-xs ct-text-muted m-0 mt-[var(--ct-space-2)]">
                A box inside an active card — for proof rows, summaries and detail
                blocks. Never panel-inside-panel (cage-in-cage).
              </p>
            </Card>
          </DsSpecimen>
        </div>
      </DsBlock>

      <DsBlock title="Callouts" hint="doc-callout (neutral) · notice (toned)">
        <DsSpecimen caption="Inline callout" classHint=".admin-doc-callout" stack>
          <div className="admin-doc-callout w-full">
            <p className="body-sm ct-text-body m-0">
              A neutral, bordered note for context inside a document flow — no
              accent fill, no glow.
            </p>
          </div>
          <div className="admin-doc-notice w-full">
            <p className="body-xs ct-status-warning m-0">
              A toned notice sets its colour on the text (warning shown); the box
              stays a quiet hairline.
            </p>
          </div>
        </DsSpecimen>
      </DsBlock>

      <DsBlock title="Tabs" hint="SegmentedControl — quiet selection, full keyboard support">
        <DsSpecimen caption="Interactive — pick a view" classHint="<SegmentedControl>" stack>
          <DsTabsDemo />
        </DsSpecimen>
      </DsBlock>

      <DsBlock title="Rows & list items" hint="DataRow · ProofRow — zero visual difference, semantic intent">
        <DsSpecimen caption="Data & proof rows" example stack>
          <Card hoverOverlay={false} material="flat" className="w-full">
            <NestedPanel>
              <DataRow label="Min ticket">$250,000</DataRow>
              <DataRow label="Soft lock-up">60 days</DataRow>
              <ProofRow label="Attestor">Hearst SPV</ProofRow>
              <ProofRow label="Block">0x1f…a90</ProofRow>
            </NestedPanel>
          </Card>
        </DsSpecimen>
      </DsBlock>

      <DsBlock title="Form fields" hint=".ct-input · .ct-select · .ct-textarea">
        <Card hoverOverlay={false}>
          <div className="admin-doc-form-grid-2">
            <label className="admin-doc-stack--compact">
              <span className="stat-label ct-text-muted">Label</span>
              <TextField
                className="ct-input"
                placeholder="Placeholder text"
                defaultValue=""
                aria-label="Example text field"
              />
            </label>
            <label className="admin-doc-stack--compact">
              <span className="stat-label ct-text-muted">Select</span>
              <Select className="ct-select" defaultValue="yield" aria-label="Example select">
                <option value="yield">Yield Vault</option>
                <option value="defensive">Defensive Vault</option>
                <option value="btc">BTC Plus</option>
              </Select>
            </label>
          </div>
          <label className="admin-doc-stack--compact mt-[var(--ct-space-4)]">
            <span className="stat-label ct-text-muted">Textarea</span>
            <Textarea
              className="ct-textarea"
              rows={2}
              placeholder="Multi-line input…"
              defaultValue=""
              aria-label="Example textarea"
            />
          </label>
        </Card>
      </DsBlock>

      <DsBlock title="Empty · error · loading" hint="EmptySurface · PanelStatus · Skeleton">
        <div className="ds-grid--two ds-grid">
          <DsSpecimen caption="Empty" classHint="<EmptySurface>" stack>
            <EmptySurface
              message="No positions yet"
              detail="Approved deposits will appear here."
            />
          </DsSpecimen>
          <DsSpecimen caption="Error" classHint="<PanelStatus tone='danger'>" stack>
            <PanelStatus
              tone="danger"
              message="Couldn't load signals"
              detail="Retry or check the data source."
            />
          </DsSpecimen>
          <DsSpecimen caption="Loading" classHint="<Skeleton>" stack>
            <div className="admin-doc-stack--tight w-full">
              <Skeleton className="h-4 w-1/3" variant="text" />
              <Skeleton className="h-16 w-full" />
            </div>
          </DsSpecimen>
        </div>
      </DsBlock>
    </DsSection>
  );
}
