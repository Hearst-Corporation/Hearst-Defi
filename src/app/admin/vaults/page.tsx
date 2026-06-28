import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminUrlTabFilter } from "@/components/admin/admin-url-tab-filter";
import { AdminKpiStripPanel } from "@/components/admin/dashboard/admin-kpi-strip-panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { VaultActionButton } from "@/components/admin/vault-action-button";
import { ApyRange } from "@/components/ui/apy-range";
import { BENTO_PRIMARY_BTN, BENTO_SECONDARY_BTN } from "@/components/ui/bento";
import { EmptySurface } from "@/components/ui/empty-surface";
import { Progress } from "@/components/ui/progress";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { prisma } from "@/lib/db";
import { STRATEGY_LABELS } from "@/lib/constants/vault";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { buildVaultsKpiStrip } from "@/lib/admin/vaults-kpi-strip";

import { VaultStatusPill } from "@/components/admin/vault-status-pill";

import { pauseVault, resumeVault } from "./actions";

export const dynamic = "force-dynamic";

// Shared table chrome — mirrors the customers canon (head = micro nano label,
// rows = transparent border + faint hover wash). Centralized so the columns
// stay in lockstep with the other admin list tables.
const TABLE_HEAD = "bg-transparent ct-bento-label";
const TABLE_WRAP = "max-w-full [&_th]:whitespace-nowrap";
const ROW =
  "border-transparent transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)]";

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
    <div className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Vault"
          titleAccent="Portfolio"
          contextLabel="Vault Portfolio"
          filters={
            <AdminUrlTabFilter
              ariaLabel="Filter vaults by status"
              activeKey={activeFilter}
              tabs={FILTER_TABS.map((tab) => ({
                key: tab.key,
                label: tab.label,
                href:
                  tab.key === "all"
                    ? "/admin/vaults"
                    : `/admin/vaults?filter=${tab.key}`,
              }))}
            />
          }
          actions={
            <Link href="/admin/vaults/new" className={BENTO_PRIMARY_BTN}>
              + New deployment
            </Link>
          }
        />

        {/* List — header (KPI strip) → Catalyst table soudés dans UNE box card
            (pattern Portfolio / customers canon). */}
        <section
          className="flex flex-col overflow-hidden rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm"
          aria-label="Vault deployments"
        >
          {portfolioKpis.length > 0 && (
            <AdminKpiStripPanel
              kpis={portfolioKpis}
              title="Vault Portfolio"
              subtitle={`${vaults.length} ${vaults.length === 1 ? "deployment" : "deployments"} in view`}
              embedded
            />
          )}

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
                className="ct-metric-caption mt-1 underline underline-offset-2 transition-colors hover:text-[var(--ct-text-strong)]"
              >
                Create the first one
              </Link>
            </EmptySurface>
          ) : (
            <Table dense className={TABLE_WRAP}>
              <TableHead>
                <TableRow>
                  <TableHeader className={`${TABLE_HEAD} pl-5`}>
                    Vault
                  </TableHeader>
                  <TableHeader className={TABLE_HEAD}>Status</TableHeader>
                  <TableHeader className={TABLE_HEAD}>
                    Principal vs Capacity
                  </TableHeader>
                  <TableHeader className={TABLE_HEAD}>Target APY</TableHeader>
                  <TableHeader className={`${TABLE_HEAD} pr-5 text-right`}>
                    <span className="sr-only">Actions</span>
                  </TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {vaults.map((vault) => {
                  const aumUsdc = vault.positions.reduce(
                    (sum, p) => sum + Number(p.principalUsdc),
                    0,
                  );
                  const capacityUsdc = Number(vault.capacityUsdc);
                  const aumPct =
                    capacityUsdc > 0 ? (aumUsdc / capacityUsdc) * 100 : 0;
                  const apyLow = Number(vault.targetApyLowBps) / 100;
                  const apyHigh = Number(vault.targetApyHighBps) / 100;
                  return (
                    <TableRow key={vault.id} className={ROW}>
                      {/* Identity */}
                      <TableCell className="pl-5 align-top">
                        <div className="flex flex-col gap-0.5">
                          <span className="ct-metric-value font-mono">
                            {vault.ticker}
                          </span>
                          <span className="ct-metric-caption truncate">
                            {vault.name}
                          </span>
                          <span className="ct-metric-caption text-[var(--ct-text-faint)]">
                            {STRATEGY_LABELS[vault.strategy] ?? vault.strategy}
                          </span>
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="align-top">
                        <VaultStatusPill status={vault.status} />
                      </TableCell>

                      {/* Principal vs Capacity — positions-sum; may differ from
                          LP-visible Reported AUM (VaultSnapshot) */}
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <Progress
                              value={aumPct}
                              label={`Deployed principal vs capacity for ${vault.ticker}`}
                              variant="plain"
                              className="h-1 flex-1"
                            />
                            <ProvenanceBadge kind="manual" variant="strip" />
                          </div>
                          <span className="ct-metric-caption font-mono tabular-nums">
                            {formatUsdCompact(aumUsdc)} /{" "}
                            {formatUsdCompact(capacityUsdc)}
                          </span>
                        </div>
                      </TableCell>

                      {/* Target APY */}
                      <TableCell className="align-top">
                        <div className="flex items-center gap-1.5">
                          <ApyRange low={apyLow} high={apyHigh} precision={1} />
                          <ProvenanceBadge kind="estimated" variant="strip" />
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="pr-5 align-top">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Link
                            href={`/admin/vaults/${vault.id}`}
                            className={BENTO_SECONDARY_BTN}
                          >
                            View
                          </Link>
                          <Link
                            href={`/admin/vaults/new?cloneFrom=${encodeURIComponent(vault.ticker)}`}
                            className={BENTO_SECONDARY_BTN}
                          >
                            Clone
                          </Link>
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
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </div>
  );
}
