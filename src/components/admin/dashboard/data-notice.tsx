import { Card } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import type { DashboardDataNotice } from "@/lib/admin/dashboard-page-view";

const NOT_GUARANTEED =
  "Outputs are projections, not guaranteed. Past performance does not predict future results.";

function pickDisclaimer(assumptions: string[]): string {
  const match = assumptions.find((line) => /not guaranteed/i.test(line));
  return match ?? NOT_GUARANTEED;
}

export function DashboardDataNotice({ notice }: { notice: DashboardDataNotice }) {
  if (notice.kind === "preview") {
    return (
      <Card
        role="status"
        className="relative z-10 border-(--ct-status-warning-border) bg-transparent"
      >
        <div className="admin-doc-inline-row admin-doc-inline-row--actions">
          <span className="stat-label ct-status-warning">
            Per-vault live snapshot pending
          </span>
          <ProvenanceBadge kind="estimated" />
        </div>
        <p className="mt-3 body-sm ct-text-muted max-w-3xl">
          {notice.vaultName} live KPIs (capital, risk, yield) land with the Phase 3
          multi-vault schema. Capital and yield below are the {notice.vaultName}{" "}
          methodology preset — the action queue and proof status remain live and
          platform-wide.
        </p>
        <p className="mt-2 body-xs ct-text-faint max-w-3xl">
          {pickDisclaimer(notice.assumptions)}
        </p>
      </Card>
    );
  }

  if (notice.kind === "staging") {
    return (
      <Card
        role="status"
        className="relative z-10 border-(--ct-status-info-border) bg-transparent"
      >
        <div className="admin-doc-inline-row admin-doc-inline-row--actions">
          <span className="stat-label ct-text-muted">
            Local seed data · Staging signals — not production
          </span>
          <ProvenanceBadge kind="manual" />
        </div>
        <p className="mt-3 body-sm ct-text-muted max-w-3xl">
          KPIs are sourced from{" "}
          <code className="font-mono">{notice.snapshotSource}</code> snapshots. Run{" "}
          <code className="font-mono">db:seed</code> with live oracle data or ingest a
          real snapshot to activate production provenance badges.
        </p>
      </Card>
    );
  }

  return (
    <Card
      role="status"
      className="relative z-10 border-(--ct-status-info-border) bg-transparent"
    >
      <div className="admin-doc-inline-row admin-doc-inline-row--actions">
        <span className="stat-label ct-text-muted">
          Vault KPIs awaiting first live snapshot
        </span>
        <ProvenanceBadge kind="estimated" />
      </div>
      <p className="mt-3 body-sm ct-text-muted max-w-3xl">
        Capital, APY, risk, mining, and NAV below are per-vault timeline metrics for{" "}
        {notice.vaultName}. Action queue, proof status, distributions, and audit trail
        are platform-wide operator signals — they do not imply this vault&apos;s KPIs are
        live.
      </p>
      <p className="mt-2 body-xs ct-text-faint max-w-3xl">
        {pickDisclaimer(notice.assumptions)}
      </p>
    </Card>
  );
}
