import { EmptySurface } from "@/components/ui/empty-surface";
import { Card } from "@/components/ui/card";
import { PanelStatus } from "@/components/ui/panel-status";
import { Metric } from "@/components/ui/metric";
import { MetricGrid } from "@/components/ui/nested-panel";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import type { CustodySnapshot } from "@/lib/data/custody";
import { sectionDividerClass } from "@/lib/ui/surface-classes";
import { cn } from "@/lib/cn";

import { formatNestedTimestamp, formatUsdCompact, isOlderThan24h } from "./formatters";

function custodyProvenance(snapshot: CustodySnapshot): "attested" | "stale" {
  const live = snapshot.provenance === "live" && snapshot.configured;
  const fresh = !isOlderThan24h(new Date(snapshot.asOf));
  return live && fresh ? "attested" : "stale";
}

function isCustodyDisplayable(custody: CustodySnapshot): boolean {
  return custody.totalUsdcReserves > 0 && custodyProvenance(custody) === "attested";
}

const CUSTODY_EMPTY = {
  message: "Custody reserves will appear after the first verified Fireblocks snapshot.",
  detail:
    "Fireblocks reserve scope must be pinned and a fresh snapshot posted before USDC reserves are shown here.",
} as const;

function CustodyStaleNote({ custody }: { custody: CustodySnapshot }) {
  if (custodyProvenance(custody) !== "stale") return null;
  return (
    <p className="proof-note body-xs ct-status-warning">
      {custody.provenance === "live" && !custody.configured
        ? "Reserve scope is not yet configured by operations — badge shows Stale."
        : "Custody snapshot is unverified or older than 24h — badge shows Stale."}
    </p>
  );
}

function CustodyKpis({ custody }: { custody: CustodySnapshot }) {
  const snapshotTs = formatNestedTimestamp(new Date(custody.asOf));
  return (
    <>
      <MetricGrid columns={3}>
        <Metric
          variant="nested"
          label="USDC reserves"
          value={formatUsdCompact(custody.totalUsdcReserves)}
        />
        <Metric
          variant="nested"
          label="Vault accounts"
          value={custody.accountsCount.toString()}
        />
        <Metric
          variant="nested"
          label="Snapshot at"
          value={snapshotTs.value}
          sublabel={snapshotTs.sublabel}
        />
      </MetricGrid>
      <CustodyStaleNote custody={custody} />
    </>
  );
}

function CustodyCard({ custody }: { custody: CustodySnapshot }) {
  return (
    <Card>
      <DashboardPanelHeader
        title="Custody (Fireblocks)"
        provenance={custodyProvenance(custody)}
        tone="primary"
      />
      <CustodyKpis custody={custody} />
    </Card>
  );
}

function CustodyBlock({ custody }: { custody: CustodySnapshot }) {
  return (
    <div className={cn(sectionDividerClass, "proof-article-separated")}>
      <DashboardPanelHeader
        title="Custody (Fireblocks)"
        provenance={custodyProvenance(custody)}
        tone="quiet"
        className="proof-custody-block-header"
      />
      <CustodyKpis custody={custody} />
    </div>
  );
}

/** Renders custody card, nested block, or empty state (standalone / inline). */
export function CustodySection({
  custody,
  nested = false,
}: {
  custody: CustodySnapshot;
  nested?: boolean;
}) {
  if (isCustodyDisplayable(custody)) {
    return nested ? <CustodyBlock custody={custody} /> : <CustodyCard custody={custody} />;
  }

  if (nested) {
    return (
      <div className={cn(sectionDividerClass, "proof-article-separated")}>
        <PanelStatus {...CUSTODY_EMPTY} />
      </div>
    );
  }

  return <EmptySurface live {...CUSTODY_EMPTY} />;
}
