import Link from "next/link";

import { VaultActionButton } from "@/components/admin/vault-action-button";
import { VaultStatusPill } from "@/components/admin/vault-status-pill";
import { pauseVault, resumeVault } from "@/app/admin/vaults/actions";
import { buildVaultsKpiStrip } from "@/lib/admin/vaults-kpi-strip";
import { STRATEGY_LABELS } from "@/lib/constants/vault";
import { prisma } from "@/lib/db";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { cn } from "@/lib/cn";
import {
  Badge,
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
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

function isFilterKey(v: unknown): v is FilterKey {
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
  activeFilter: FilterKey;
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
  const allVaults = allVaultsRaw.filter((v) => !isSingleRunDraft(v));
  const vaults =
    activeFilter === "all"
      ? allVaults
      : allVaults.filter((v) => v.status === activeFilter);

  const portfolioKpis = buildVaultsKpiStrip(
    allVaults.map((v) => ({
      aumUsdc: v.positions.reduce((sum, p) => sum + Number(p.principalUsdc), 0),
      capacityUsdc: Number(v.capacityUsdc),
      status: v.status,
    })),
  );

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Admin"
        title="Vault portfolio"
        description={`${vaults.length} deployment(s) in view.`}
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
              <div className="p-5">
                <Kpi
                  label={kpi.label}
                  value={kpi.value}
                  hint={kpi.sublabel}
                  provenance={
                    kpi.provenance === "manual" ||
                    kpi.provenance === "estimated" ||
                    kpi.provenance === "live"
                      ? kpi.provenance
                      : "manual"
                  }
                />
              </div>
            </Panel>
          ))}
        </KpiGrid>
      ) : null}

      <Section title="Deployments" description="Filter by lifecycle status">
        <nav
          className="mb-4 flex flex-wrap gap-2"
          aria-label="Filter vaults by status"
        >
          {FILTER_TABS.map((tab) => {
            const href =
              tab.key === "all"
                ? "/admin/vaults"
                : `/admin/vaults?filter=${tab.key}`;
            const active = tab.key === activeFilter;
            return (
              <Link key={tab.key} href={href}>
                <Badge
                  variant={active ? "accent" : "outline"}
                  className={cn("cursor-pointer px-3 py-1")}
                >
                  {tab.label}
                </Badge>
              </Link>
            );
          })}
        </nav>

        <Panel>
          {vaults.length === 0 ? (
            <EmptyState
              title="No deployments found"
              description="Vault deployments will appear here once created."
              action={
                <Link href="/admin/vaults/new" className="text-sm text-accent hover:underline">
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
                            <ProvenanceBadge source="manual" />
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
                          <ProvenanceBadge source="estimated" />
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
