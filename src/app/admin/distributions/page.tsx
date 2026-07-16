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
      {/* v2 model — honest state: the mining note has no periodic cash
          distribution, so the legacy "compute + confirm a monthly distribution"
          gesture no longer has an object. We do NOT render a payment action. */}
      <AdminSectionCard
        title="Mining note — accumulation model"
        subtitle="How the v2 product returns capital"
        ariaLabel="v2 distribution model"
      >
        <div className="admin-doc-stack p-5">
          <p className="body-sm ct-text-body">
            The v2 product is a mining note: it accumulates BTC over a ~24-month
            term with rule-based take-profit, and delivers the accumulated BTC at
            maturity. There is <span className="ct-text-strong">no periodic
            cash distribution</span> and no fixed APY paid out — so there is no
            monthly distribution to compute or confirm here.
          </p>
          <ul className="admin-doc-stack admin-doc-stack--compact body-sm ct-text-muted">
            <li>
              • Three pockets: Mining Power, BTC Pouch, and a USDC reserve.
            </li>
            <li>
              • Returns are BTC accumulated over the term with take-profit
              triggered by rules — not distributed in cash.
            </li>
            <li>
              • Estimated yield is a range, not guaranteed. Projections are
              conditional on the stated assumptions.
            </li>
          </ul>
        </div>
      </AdminSectionCard>

      {/* Distribution history — historical records only (legacy). */}
      <AdminSectionCard
        kpis={distributionKpis}
        kpiTitle="Distribution summary"
        kpiSubtitle={`${history.length} historical ${history.length === 1 ? "record" : "records"}`}
        title={`History (${activeVaultLabel})`}
        subtitle="Historical distribution records for this vault (legacy)"
        ariaLabel="Distribution history"
      >
        {history.length === 0 ? (
          <EmptySurface
            variant="widget"
            message={`No distribution records for ${activeVaultLabel}.`}
            detail="The v2 mining note has no periodic cash distribution; this table only shows legacy historical records, if any exist."
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
                    <TableCell className="ct-metric-caption mono">
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
                    <TableCell className="ct-metric-caption hidden text-right mono xl:table-cell">
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
        subtitle="Records shown above are historical only. They are not a commitment to any future distribution. The v2 mining note does not distribute cash periodically. Past records are not a reliable indicator of future performance."
        ariaLabel="Historical record disclaimer"
      />
    </AdminPageShell>
  );
}
