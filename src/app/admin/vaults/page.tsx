import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminUrlTabFilter } from "@/components/admin/admin-url-tab-filter";
import { AdminKpiStripPanel } from "@/components/admin/dashboard/admin-kpi-strip-panel";
import { VaultActionButton } from "@/components/admin/vault-action-button";
import { ApyRange } from "@/components/ui/apy-range";
import { Button } from "@/components/ui/button";
import { EmptySurface } from "@/components/ui/empty-surface";
import { Progress } from "@/components/ui/progress";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { prisma } from "@/lib/db";
import { STRATEGY_LABELS } from "@/lib/constants/vault";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { buildVaultsKpiStrip } from "@/lib/admin/vaults-kpi-strip";

import { VaultStatusPill } from "@/components/admin/vault-status-pill";

import { pauseVault, resumeVault } from "./actions";

import "../admin-strategy.css";

export const dynamic = "force-dynamic";

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "review", label: "Review" },
  { key: "live", label: "Live" },
  { key: "paused", label: "Paused" },
  { key: "closed", label: "Closed" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

function isFilterKey(v: unknown): v is FilterKey {
  return FILTER_TABS.some((t) => t.key === v);
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function VaultsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawFilter = params["filter"];
  const activeFilter: FilterKey = isFilterKey(rawFilter) ? rawFilter : "all";

  // Fetch all vaults (unfiltered) once — filter in JS so KPIs always reflect
  // the full portfolio regardless of the active tab.
  const allVaults = await prisma.vaultDeployment.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      positions: {
        where: { status: "active" },
        select: { principalUsdc: true },
      },
    },
  });

  const vaults =
    activeFilter === "all"
      ? allVaults
      : allVaults.filter((v) => v.status === activeFilter);

  // Derive KPIs from the full portfolio (not the filtered view).
  const kpiInputs = allVaults.map((v) => ({
    aumUsdc: v.positions.reduce((sum, p) => sum + Number(p.principalUsdc), 0),
    capacityUsdc: Number(v.capacityUsdc),
    status: v.status,
  }));
  const portfolioKpis = buildVaultsKpiStrip(kpiInputs);

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Vaults"
        eyebrow="Vault portfolio"
        description="Review deployment status, capacity usage, target yield ranges, and operator actions across vaults."
        actions={
          <Button variant="primary" asChild size="md">
            <Link href="/admin/vaults/new">+ New deployment</Link>
          </Button>
        }
      />

      {/* Portfolio KPI summary — only shown when there are vaults */}
      {portfolioKpis.length > 0 && (
        <AdminKpiStripPanel kpis={portfolioKpis} />
      )}

      <AdminUrlTabFilter
        ariaLabel="Filter vaults by status"
        activeKey={activeFilter}
        tabs={FILTER_TABS.map((tab) => ({
          key: tab.key,
          label: tab.label,
          href:
            tab.key === "all" ? "/admin/vaults" : `/admin/vaults?filter=${tab.key}`,
        }))}
      />

      {/* List */}
      {vaults.length === 0 ? (
        <EmptySurface
          variant="widget"
          message="No deployments found."
          detail="Vault deployments will appear here once created."
          className="min-h-32"
          ariaLabel="Vault deployments awaiting creation"
        >
          <Link
            href="/admin/vaults/new"
            className="body-xs ct-text-muted hover:ct-text-primary admin-strategy-empty-link"
          >
            Create the first one
          </Link>
        </EmptySurface>
      ) : (
        <section aria-label="Vault deployments" className="admin-vaults-list">
          {/* Column headers */}
          <div className="admin-vaults-list__header" aria-hidden>
            <span className="body-xs ct-text-muted font-bold uppercase tracking-wider">Vault</span>
            <span className="body-xs ct-text-muted font-bold uppercase tracking-wider">Status</span>
            <span className="body-xs ct-text-muted font-bold uppercase tracking-wider">Principal vs Capacity</span>
            <span className="body-xs ct-text-muted font-bold uppercase tracking-wider">Target APY</span>
            <span className="body-xs ct-text-muted font-bold uppercase tracking-wider sr-only">Actions</span>
          </div>

          {vaults.map((vault) => {
            const aumUsdc = vault.positions.reduce(
              (sum, p) => sum + Number(p.principalUsdc),
              0,
            );
            const capacityUsdc = Number(vault.capacityUsdc);
            const aumPct = capacityUsdc > 0 ? (aumUsdc / capacityUsdc) * 100 : 0;
            const apyLow = Number(vault.targetApyLowBps) / 100;
            const apyHigh = Number(vault.targetApyHighBps) / 100;
            return (
              <div
                key={vault.id}
                className="admin-vaults-list__row"
                aria-label={`${vault.ticker} deployment`}
              >
                {/* Identity */}
                <div className="admin-vaults-list__identity">
                  <span className="mono tabular body-sm font-semibold ct-text-strong">
                    {vault.ticker}
                  </span>
                  <span className="body-xs ct-text-muted truncate">
                    {vault.name}
                  </span>
                  <span className="body-xs ct-text-faint">
                    {STRATEGY_LABELS[vault.strategy] ?? vault.strategy}
                  </span>
                </div>

                {/* Status */}
                <div className="admin-vaults-list__status">
                  <VaultStatusPill status={vault.status} />
                </div>

                {/* Principal vs Capacity — positions-sum; may differ from LP-visible Reported AUM (VaultSnapshot) */}
                <div className="admin-vaults-list__metrics">
                  <div className="flex items-center gap-(--ct-space-2)">
                    <Progress
                      value={aumPct}
                      label={`Deployed principal vs capacity for ${vault.ticker}`}
                      variant="plain"
                      className="h-1 flex-1"
                    />
                    <ProvenanceBadge
                      kind="manual"
                      variant="strip"
                    />
                  </div>
                  <span className="mono tabular body-xs ct-text-muted">
                    {formatUsdCompact(aumUsdc)} / {formatUsdCompact(capacityUsdc)}
                  </span>
                </div>

                {/* Target APY */}
                <div className="admin-vaults-list__apy">
                  <div className="flex items-center gap-(--ct-space-1_5)">
                    <ApyRange low={apyLow} high={apyHigh} precision={1} />
                    <ProvenanceBadge kind="estimated" variant="strip" />
                  </div>
                </div>

                {/* Actions */}
                <div className="admin-vaults-list__actions">
                  <Button variant="ghost" size="md" asChild>
                    <Link href={`/admin/vaults/${vault.id}`}>View</Link>
                  </Button>
                  <Button variant="ghost" size="md" asChild>
                    <Link href={`/admin/vaults/new?cloneFrom=${encodeURIComponent(vault.ticker)}`}>
                      Clone
                    </Link>
                  </Button>
                  {vault.status === "live" && (
                    <VaultActionButton
                      label="Pause"
                      variant="ghost"
                      size="md"
                      confirm={{
                        title: "Pause this vault?",
                        description:
                          "New activity for this vault will be paused. Existing investor records remain unchanged.",
                        confirmLabel: "Pause vault",
                        confirmVariant: "danger",
                      }}
                      action={async () => {
                        "use server";
                        await pauseVault(vault.id);
                      }}
                    />
                  )}
                  {vault.status === "paused" && (
                    <VaultActionButton
                      label="Resume"
                      variant="ghost"
                      size="md"
                      confirm={{
                        title: "Resume this vault?",
                        description:
                          "This will make the vault available again according to its configured status and permissions.",
                        confirmLabel: "Resume vault",
                        confirmVariant: "primary",
                      }}
                      action={async () => {
                        "use server";
                        await resumeVault(vault.id);
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
