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
import { ProvenanceBadge } from "@/components/catalyst/provenance-badge";
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
      titleLead="Historical"
      titleAccent="Records"
      contextLabel="Retired rail · Non-Series 1"
    >
      {/* Series 1 state: this route is a read-only archive. No payment action is rendered. */}
      <AdminSectionCard
        title="Series 1 — BTC accumulation"
        subtitle="Current product model"
        ariaLabel="Series 1 current product model"
      >
        <div className="admin-doc-stack p-5">
          <p className="body-sm ct-text-body">
            Series 1 accumulates BTC over a 24-month term with rule-based
            take-profit and delivers accumulated BTC at maturity. This page is
            retained only to review records created by earlier product
            configurations; no action is available here.
          </p>
          <ul className="admin-doc-stack admin-doc-stack--compact body-sm ct-text-muted">
            <li>
              • Three pockets: Mining Power, BTC Pouch, and a USDC reserve.
            </li>
            <li>
              • BTC accumulation and take-profit events are recorded through the
              reserve evidence rail.
            </li>
            <li>
              • Projections remain conditional on their stated assumptions and
              source provenance.
            </li>
          </ul>
        </div>
      </AdminSectionCard>

      {/* Distribution history — historical records only (legacy). */}
      <AdminSectionCard
        kpis={distributionKpis}
        kpiTitle="Historical record summary"
        kpiSubtitle={`${history.length} historical ${history.length === 1 ? "record" : "records"}`}
        title={`History (${activeVaultLabel})`}
        subtitle="Retired records retained for audit continuity"
        ariaLabel="Retired historical records"
      >
        {history.length === 0 ? (
          <EmptySurface
            variant="widget"
            message={`No historical records for ${activeVaultLabel}.`}
            detail="This retired admin archive remains available for audit continuity."
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
                  Recorded at
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
                          className="block max-w-full truncate rounded-sm text-[var(--ct-accent)] hover:underline focus-visible:outline-none ct-focus-ring"
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
        subtitle="Records shown above belong to retired product configurations and are preserved only for audit continuity. They are not part of the Series 1 reserve evidence rail."
        ariaLabel="Historical record disclaimer"
      />
    </AdminPageShell>
  );
}
