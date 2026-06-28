import Link from "next/link";

import { prisma } from "@/lib/db";
import {
  AdminPageShell,
  AdminSectionCard,
  TABLE_HEAD,
  TABLE_WRAP,
  ROW,
} from "@/components/admin/admin-page-shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import {
  distributionVaultScopeWhere,
  matchesDistributionVaultScope,
  resolveFixtureVaultId,
} from "@/lib/vaults/dashboard-scope";
import { formatAdminDate, formatUsdDetailed } from "@/lib/vaults/product-display";
import { listAllVaults, vaultSlug, vaultLabel } from "@/lib/vaults/resolver";
import { buildDistributionsKpiStrip } from "@/lib/admin/distributions-kpi-strip";
import { DistributionForm } from "./distribution-form";

export const dynamic = "force-dynamic";

interface DistributionsPageProps {
  searchParams: Promise<{ vault?: string }>;
}

const LEGACY_VAULT_LABELS: Record<string, string> = {
  "hearst-yield-vault": "Hearst Yield Vault",
};

export default async function DistributionsPage({
  searchParams,
}: DistributionsPageProps) {
  const params = await searchParams;
  const vaultId = resolveFixtureVaultId(params.vault);

  const [rawHistory, allVaults] = await Promise.all([
    prisma.distribution.findMany({
      where: distributionVaultScopeWhere(vaultId),
      orderBy: { distributedAt: "desc" },
      take: 6,
    }),
    listAllVaults({ status: "live-or-paused" }),
  ]);

  // Build a map vaultRef (slug) → label for quick lookup in the history table.
  const vaultOptions = allVaults.map((ref) => ({
    value: vaultSlug(ref),
    label: vaultLabel(ref),
  }));

  // For the history table we also need a slug → label map.
  const vaultLabelBySlug = new Map<string, string>(
    vaultOptions.map((o) => [o.value, o.label]),
  );
  const history = rawHistory.filter((entry) =>
    matchesDistributionVaultScope(entry.vaultRef, vaultId),
  );
  const activeVaultLabel = vaultLabelBySlug.get(vaultId) ?? vaultId;
  const distributionKpis = buildDistributionsKpiStrip(history);

  return (
    <AdminPageShell
      titleLead="Vault"
      titleAccent="Distributions"
      contextLabel="Vaults"
    >
      {/* Compute + confirm form (client) */}
      <DistributionForm vaultOptions={vaultOptions} initialVault={vaultId} />

      {/* Distribution history — welded card: optional KPI strip → header → table */}
      <AdminSectionCard
        kpis={distributionKpis}
        kpiTitle="Distribution summary"
        kpiSubtitle={`${history.length} confirmed ${history.length === 1 ? "distribution" : "distributions"}`}
        title={`History (${activeVaultLabel})`}
        subtitle="Confirmed distributions for this vault"
        ariaLabel="Distribution history"
      >
        {history.length === 0 ? (
          <EmptySurface
            variant="widget"
            message={`No distributions yet for ${activeVaultLabel}.`}
            detail="Confirmed distributions for this vault will appear here after multisig approval."
            className="min-h-32"
          />
        ) : (
          <Table dense className={TABLE_WRAP}>
            <TableHead>
              <TableRow>
                <TableHeader className={`${TABLE_HEAD} pl-5`}>Vault</TableHeader>
                <TableHeader className={TABLE_HEAD}>Period</TableHeader>
                <TableHeader className={`${TABLE_HEAD} text-right`}>
                  Amount (USDC)
                </TableHeader>
                <TableHeader
                  className={`${TABLE_HEAD} hidden text-right md:table-cell`}
                >
                  Recipients
                </TableHeader>
                <TableHeader className={`${TABLE_HEAD} text-right`}>
                  Distributed at
                </TableHeader>
                <TableHeader
                  className={`${TABLE_HEAD} hidden text-right xl:table-cell`}
                >
                  Tx hash
                </TableHeader>
                <TableHeader
                  className={`${TABLE_HEAD} hidden pr-5 text-right lg:table-cell`}
                >
                  Source
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((d) => {
                const slug = d.vaultRef;
                const label = slug
                  ? (LEGACY_VAULT_LABELS[slug] ??
                    vaultLabelBySlug.get(slug) ??
                    slug)
                  : null;

                const vaultHref = slug
                  ? slug === "yield" || slug === "defensive" || slug === "btc-plus"
                    ? `/admin/dashboard${slug !== "yield" ? `?vault=${slug}` : ""}`
                    : `/admin/vaults/${slug}`
                  : null;

                return (
                  <TableRow key={d.id} className={ROW}>
                    <TableCell className="ct-metric-value truncate pl-5">
                      {vaultHref && label ? (
                        <Link
                          href={vaultHref}
                          className="block max-w-full truncate text-[var(--ct-accent)] hover:underline"
                        >
                          {label}
                        </Link>
                      ) : label ? (
                        <span className="text-[var(--ct-text-secondary)]">
                          {label}
                        </span>
                      ) : (
                        <span className="text-[var(--ct-text-muted)]">—</span>
                      )}
                    </TableCell>
                    <TableCell className="ct-metric-caption font-mono">
                      {d.period}
                    </TableCell>
                    <TableCell className="ct-metric-value text-right tabular-nums">
                      {formatUsdDetailed(d.amountUsdc.toNumber())}
                    </TableCell>
                    <TableCell className="ct-metric-caption hidden text-right tabular-nums md:table-cell">
                      {d.recipientsCount}
                    </TableCell>
                    <TableCell className="ct-metric-caption text-right">
                      {formatAdminDate(new Date(d.distributedAt))}
                    </TableCell>
                    <TableCell className="ct-metric-caption hidden text-right font-mono xl:table-cell">
                      {d.txHash ? (
                        d.txHash.startsWith("0xMOCK") ? (
                          <span className="text-[var(--ct-text-muted)]">
                            simulated
                          </span>
                        ) : (
                          `${d.txHash.slice(0, 8)}…`
                        )
                      ) : (
                        <span className="text-[var(--ct-text-muted)]">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden pr-5 text-right lg:table-cell">
                      <span className="inline-flex justify-end">
                        <ProvenanceBadge
                          variant="strip"
                          kind={
                            d.txHash
                              ? d.txHash.startsWith("0xMOCK")
                                ? "estimated"
                                : "attested"
                              : "manual"
                          }
                        />
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </AdminSectionCard>

      <AdminSectionCard
        title="Historical record"
        subtitle="Distributions shown above are historical records only. They are not a commitment to any future distribution. Past distributions are not a reliable indicator of future performance or yield."
        ariaLabel="Historical record disclaimer"
      />
    </AdminPageShell>
  );
}
