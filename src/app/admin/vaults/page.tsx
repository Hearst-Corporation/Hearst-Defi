import Link from "next/link";

import {
  AdminPageShell,
  AdminSectionCard,
  TABLE_HEAD,
  ROW,
} from "@/components/admin/admin-page-shell";
import { AdminUrlTabFilter } from "@/components/admin/admin-url-tab-filter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { VaultActionButton } from "@/components/admin/vault-action-button";
import { ApyRange } from "@/components/catalyst/apy-range";
import { BENTO_PRIMARY_BTN, BENTO_SECONDARY_BTN } from "@/components/catalyst/bento";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { Progress } from "@/components/catalyst/progress";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { prisma } from "@/lib/db";
import { STRATEGY_LABELS } from "@/lib/constants/vault";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { buildVaultsKpiStrip } from "@/lib/admin/vaults-kpi-strip";

import { VaultStatusPill } from "@/components/admin/vault-status-pill";

import { pauseVault, resumeVault } from "./actions";

export const dynamic = "force-dynamic";

// Local table wrap — keep Catalyst's overflow-x-auto LOCAL to the card (no
// horizontal bleed). TABLE_HEAD / ROW come from the shell (customers canon).
const TABLE_WRAP = "max-w-full [&_th]:whitespace-nowrap";

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

  // Fetch all vaults (unfiltered by lifecycle tab) once — filter in JS so
  // KPIs always reflect the full portfolio regardless of the active tab.
  //
  // Exclude Projection Studio "Single run" scratch drafts — these are
  // one-off scenario runs saved as VaultDeployment rows for the engine, not
  // real deployments. They were already soft-retired to status="closed" in
  // the DB; hide them from the admin list entirely (both the default "All"
  // tab and the explicit "Closed" tab) rather than risk resurfacing them as
  // if they were a real closed vault lifecycle state.
  const isSingleRunDraft = (v: { name: string; status: string }) =>
    v.status === "closed" && v.name.trim().toLowerCase().startsWith("single run");

  const allVaultsRaw = await prisma.vaultDeployment.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      positions: {
        where: { status: "active" },
        select: { principalUsdc: true },
      },
    },
  });
  const allVaults = allVaultsRaw.filter((v) => !isSingleRunDraft(v));

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

  const statusFilter = (
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
  );

  return (
    <AdminPageShell
      titleLead="Vault"
      titleAccent="Portfolio"
      contextLabel="Vault Portfolio"
      headerActions={
        <Link href="/admin/vaults/new" className={BENTO_PRIMARY_BTN}>
          + New deployment
        </Link>
      }
    >
        {/* List — KPI strip → status filter sub-header → Catalyst table soudés
            dans UNE box card (pattern Portfolio / customers canon). The status
            tabs live in the section header (right slot); the "New deployment"
            CTA stays on the page title line. */}
        <AdminSectionCard
          ariaLabel="Vault deployments"
          kpis={portfolioKpis.length > 0 ? portfolioKpis : undefined}
          kpiTitle="Vault Portfolio"
          kpiSubtitle={`${vaults.length} ${vaults.length === 1 ? "deployment" : "deployments"} in view`}
          title="Deployments"
          subtitle="Filter by lifecycle status"
          headerTrailing={statusFilter}
        >
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
                  <TableHeader className={TABLE_HEAD}>Est. Return</TableHeader>
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

                      {/* Estimated return band (accumulated BTC, not a fixed APY) */}
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
        </AdminSectionCard>
    </AdminPageShell>
  );
}
