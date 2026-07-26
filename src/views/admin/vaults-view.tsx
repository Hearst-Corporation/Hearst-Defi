import Link from "next/link";

import { AdminUrlTabFilter, type AdminUrlTab } from "@/components/admin/admin-url-tab-filter";
import { VaultActionButton } from "@/components/admin/vault-action-button";
import { VaultStatusPill } from "@/components/admin/vault-status-pill";
import { FORM_SURFACE } from "@/components/admin/admin-page-shell";
import { pauseVault, resumeVault } from "@/app/admin/vaults/actions";
import {
  buildVaultsKpiStrip,
  POSITION_SUM_PROVENANCE,
  TARGET_RANGE_PROVENANCE,
} from "@/lib/admin/vaults-kpi-strip";
import { STRATEGY_LABELS } from "@/lib/constants/vault";
import { prisma } from "@/lib/db";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import {
  Button,
  EmptyState,
  Kpi,
  KpiGrid,
  ProvenanceBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui";
import { PageHeader, PageLayout, Panel, Section } from "@/views/_shared/layout";

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "review", label: "Review" },
  { key: "live", label: "Live" },
  { key: "paused", label: "Paused" },
  { key: "closed", label: "Closed" },
  // Single-run drafts (closed drafts from the run wizard) — excluded from the
  // lifecycle tabs but NEVER silently: announced below, listed here.
  { key: "archived", label: "Archived" },
] as const;

export type VaultsFilterKey = (typeof FILTER_TABS)[number]["key"];

export function isVaultsFilterKey(v: unknown): v is VaultsFilterKey {
  return FILTER_TABS.some((t) => t.key === v);
}

function CapacityBar({ pct }: { pct: number }) {
  return (
    <div
      className="h-1 flex-1 overflow-hidden rounded-full bg-surface-inset"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-accent"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

export async function AdminVaultsView({
  activeFilter,
}: {
  activeFilter: VaultsFilterKey;
}) {
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

  // Split, never drop: archived rows stay reachable via the Archived tab and
  // are announced whenever the current tab excludes them.
  const archivedVaults = allVaultsRaw.filter((v) => isSingleRunDraft(v));
  const lifecycleVaults = allVaultsRaw.filter((v) => !isSingleRunDraft(v));

  const vaults =
    activeFilter === "archived"
      ? archivedVaults
      : activeFilter === "all"
        ? lifecycleVaults
        : lifecycleVaults.filter((v) => v.status === activeFilter);

  // KPIs on the COMPLETE population — archived deployments are real
  // VaultDeployment rows; excluding them from the totals would misreport.
  const portfolioKpis = buildVaultsKpiStrip(
    allVaultsRaw.map((v) => ({
      aumUsdc: v.positions.reduce((sum, p) => sum + Number(p.principalUsdc), 0),
      capacityUsdc: Number(v.capacityUsdc),
      status: v.status,
    })),
  );

  const statusCount = (status: string) =>
    lifecycleVaults.filter((v) => v.status === status).length;

  const filterTabs: AdminUrlTab[] = FILTER_TABS.map((tab) => ({
    key: tab.key,
    label: tab.label,
    href: tab.key === "all" ? "/admin/vaults" : `/admin/vaults?filter=${tab.key}`,
    count:
      tab.key === "all"
        ? lifecycleVaults.length
        : tab.key === "archived"
          ? archivedVaults.length
          : statusCount(tab.key),
  }));

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Admin"
        title="Vault portfolio"
        description={`${allVaultsRaw.length} deployment(s) on record — ${vaults.length} in view.`}
        actions={
          <Link href="/admin/vaults/new">
            <Button>+ New deployment</Button>
          </Link>
        }
      />

      {portfolioKpis.length > 0 ? (
        <KpiGrid>
          {portfolioKpis.map((kpi) => (
            <Panel key={kpi.label}>
              <div className={FORM_SURFACE}>
                <Kpi
                  label={kpi.label}
                  value={kpi.value}
                  hint={kpi.sublabel}
                  provenance={kpi.provenance}
                />
              </div>
            </Panel>
          ))}
        </KpiGrid>
      ) : null}

      <Section title="Deployments" description="Filter by lifecycle status">
        <div className="mb-4 flex flex-col gap-2">
          <AdminUrlTabFilter
            tabs={filterTabs}
            activeKey={activeFilter}
            ariaLabel="Filter vaults by status"
          />
          {archivedVaults.length > 0 && activeFilter !== "archived" ? (
            <p className="text-xs text-[var(--ct-text-muted)]" role="status">
              {archivedVaults.length} single-run draft(s) hidden — closed drafts
              from the run wizard. See the Archived ({archivedVaults.length}) tab.
            </p>
          ) : null}
          {activeFilter === "archived" ? (
            <p className="text-xs text-[var(--ct-text-muted)]">
              Single-run drafts — closed drafts created by the run wizard,
              excluded from the lifecycle tabs but counted in the KPIs above.
            </p>
          ) : null}
        </div>

        <Panel>
          {vaults.length === 0 ? (
            <EmptyState
              title="No deployments found"
              description="Vault deployments will appear here once created."
              action={
                <Link href="/admin/vaults/new" className="text-sm text-accent-ink hover:underline">
                  Create the first one
                </Link>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vault</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Principal vs capacity</TableHead>
                  <TableHead>Est. return</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
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
                    <TableRow key={vault.id}>
                      <TableCell>
                        <div className="flex min-w-0 max-w-48 flex-col gap-0.5">
                          <span className="font-mono text-sm font-semibold text-[var(--ct-text-strong)]">
                            {vault.ticker}
                          </span>
                          <span className="truncate text-xs text-[var(--ct-text-muted)]">
                            {vault.name}
                          </span>
                          <span className="text-xs text-faint">
                            {STRATEGY_LABELS[vault.strategy] ?? vault.strategy}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <VaultStatusPill status={vault.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-[10rem] flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <CapacityBar pct={aumPct} />
                            {/* Provenance carried by the calculation (règle c2):
                                sum of LP position rows → POSITION_SUM_PROVENANCE. */}
                            <ProvenanceBadge source={POSITION_SUM_PROVENANCE} />
                          </div>
                          <span className="font-mono text-xs tabular-nums text-[var(--ct-text-muted)]">
                            {formatUsdCompact(aumUsdc)} /{" "}
                            {formatUsdCompact(capacityUsdc)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-sm tabular-nums">
                          {apyLow.toFixed(1)}–{apyHigh.toFixed(1)}%
                          <ProvenanceBadge source={TARGET_RANGE_PROVENANCE} />
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Link href={`/admin/vaults/${vault.id}`}>
                            <Button variant="secondary" size="sm">
                              View
                            </Button>
                          </Link>
                          <Link
                            href={`/admin/vaults/new?cloneFrom=${encodeURIComponent(vault.ticker)}`}
                          >
                            <Button variant="ghost" size="sm">
                              Clone
                            </Button>
                          </Link>
                          {vault.status === "live" ? (
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
                          ) : null}
                          {vault.status === "paused" ? (
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
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Panel>
      </Section>
    </PageLayout>
  );
}
