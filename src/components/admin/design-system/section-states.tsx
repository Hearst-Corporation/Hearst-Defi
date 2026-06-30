import { BentoBadge as Badge } from "@/components/catalyst/bento-badge";
import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { PanelStatus } from "@/components/catalyst/panel-status";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Skeleton } from "@/components/catalyst/skeleton";

import { DsBlock, DsSection, DsSpecimen } from "./ds-kit";

export function SectionStates() {
  return (
    <DsSection
      id="states"
      index="E"
      title="States"
      lead="One canonical chrome per state, so agents stop inventing cheap skeletons or empty states. Status is carried by colour + label, never by a new green."
    >
      <DsBlock title="Status chips" hint="active · verified · pending · warning · success · error">
        <DsSpecimen caption="Canonical state badges">
          <Badge variant="accent">Active</Badge>
          <Badge variant="success">Verified</Badge>
          <Badge variant="warning">Pending</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="danger">Error</Badge>
        </DsSpecimen>
      </DsBlock>

      <DsBlock title="Verified vs pending" hint="Provenance is the trust signal — not a fake Live badge">
        <DsSpecimen caption="Trust state">
          <span className="admin-doc-inline-row--micro admin-doc-inline-row">
            <ProvenanceBadge kind="attested" />
            <span className="body-xs ct-text-muted">verified evidence</span>
          </span>
          <span className="admin-doc-inline-row--micro admin-doc-inline-row">
            <ProvenanceBadge kind="estimated" />
            <span className="body-xs ct-text-muted">pending / projected</span>
          </span>
        </DsSpecimen>
      </DsBlock>

      <DsBlock title="Disabled" hint="Reduced opacity + cursor, aria-disabled announced">
        <DsSpecimen caption="Disabled controls" stack>
          <div className="admin-doc-inline-row admin-doc-inline-row--loose">
            <Button variant="primary" size="md" disabled>
              Submit
            </Button>
            <Button variant="secondary" size="md" disabled>
              Cancel
            </Button>
          </div>
          <input
            className="ct-input"
            placeholder="Disabled field"
            disabled
            aria-label="Disabled example field"
          />
        </DsSpecimen>
      </DsBlock>

      <DsBlock title="Loading" hint="Skeleton shimmer — structural placeholder, never fake numbers">
        <DsSpecimen caption="Loading skeleton" stack>
          <div className="admin-doc-stack--tight w-full">
            <Skeleton className="h-4 w-1/4" variant="text" />
            <Skeleton className="h-20 w-full" />
            <div className="admin-doc-inline-row">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        </DsSpecimen>
      </DsBlock>

      <DsBlock title="Empty & error" hint="EmptySurface · PanelStatus(tone='danger')">
        <div className="ds-grid--two ds-grid">
          <DsSpecimen caption="Empty" stack>
            <EmptySurface
              message="Nothing here yet"
              detail="Content appears once data is available."
            />
          </DsSpecimen>
          <DsSpecimen caption="Error" stack>
            <PanelStatus
              tone="danger"
              message="Something went wrong"
              detail="The source is unavailable — retry shortly."
            />
          </DsSpecimen>
        </div>
      </DsBlock>
    </DsSection>
  );
}
