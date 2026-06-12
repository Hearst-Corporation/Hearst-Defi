import Link from "next/link";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { FixtureVaultPills } from "@/components/admin/fixture-vault-pills";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { EmptySurface } from "@/components/ui/empty-surface";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { SystemPanel } from "@/components/ui/system-panel";
import {
  adminDistributionsVaultHref,
  resolveFixtureVaultId,
} from "@/lib/vaults/dashboard-scope";
import { listAllVaults, vaultSlug, vaultLabel } from "@/lib/vaults/resolver";
import { DistributionForm } from "./distribution-form";

export const dynamic = "force-dynamic";

import { formatAdminDate, formatUsdDetailed } from "@/lib/vaults/product-display";

interface DistributionsPageProps {
  searchParams: Promise<{ vault?: string }>;
}

export default async function DistributionsPage({
  searchParams,
}: DistributionsPageProps) {
  await requireAdmin();

  const params = await searchParams;
  const vaultId = resolveFixtureVaultId(params.vault);

  const [history, allVaults] = await Promise.all([
    prisma.distribution.findMany({
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

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Distributions"
        actions={
          <FixtureVaultPills
            activeVaultId={vaultId}
            resolveHref={adminDistributionsVaultHref}
          />
        }
      />

      {/* Compute + confirm form (client) */}
      <DistributionForm vaultOptions={vaultOptions} />

      {/* Distribution history */}
      <section className="admin-doc-stack--actions">
        <h2 className="h2">History (last 6)</h2>

        {history.length === 0 ? (
          <EmptySurface
            variant="widget"
            message="No distributions yet."
            detail="Confirmed distributions will appear here after multisig approval."
            className="min-h-32"
          />
        ) : (
          <SystemPanel className="p-0 overflow-hidden">
            <div className="ct-table-surface border-0 rounded-none overflow-x-auto">
              <table className="w-full body-sm tabular">
                <thead>
                  <tr className="ct-surface-1">
                    <th className="text-left ct-table-header stat-label">
                      Vault
                    </th>
                    <th className="text-left ct-table-header stat-label">
                      Period
                    </th>
                    <th className="text-right ct-table-header stat-label">
                      Amount (USDC)
                    </th>
                    <th className="text-right ct-table-header stat-label">
                      Recipients
                    </th>
                    <th className="text-right ct-table-header stat-label">
                      Distributed at
                    </th>
                    <th className="text-right ct-table-header stat-label">
                      Tx hash
                    </th>
                    <th className="text-right ct-table-header stat-label">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((d) => {
                    const slug = d.vaultRef;
                    const label = slug
                      ? (vaultLabelBySlug.get(slug) ?? slug)
                      : null;

                    // Fixture slugs navigate to /admin/dashboard?vault=<slug>;
                    // deployment slugs navigate to /admin/vaults/<slug> (ticker lowercase).
                    // Without a vaultRef we render plain text.
                    const vaultHref = slug
                      ? slug === "yield" || slug === "defensive" || slug === "btc-plus"
                        ? `/admin/dashboard${slug !== "yield" ? `?vault=${slug}` : ""}`
                        : `/admin/vaults/${slug}`
                      : null;

                    return (
                      <tr
                        key={d.id}
                        className="border-t ct-border-soft ct-hover-surface transition-colors"
                      >
                        <td className="ct-table-cell body-xs ct-text-body">
                          {vaultHref && label ? (
                            <Link
                              href={vaultHref}
                              className="ct-text-accent hover:underline font-medium"
                            >
                              {label}
                            </Link>
                          ) : label ? (
                            <span className="ct-text-muted">{label}</span>
                          ) : (
                            <span className="ct-text-faint">—</span>
                          )}
                        </td>
                        <td className="ct-table-cell mono body-xs ct-text-body">
                          {d.period}
                        </td>
                        <td className="ct-table-cell text-right body-sm ct-text-strong tabular">
                          {formatUsdDetailed(d.amountUsdc.toNumber())}
                        </td>
                        <td className="ct-table-cell text-right ct-text-muted tabular">
                          {d.recipientsCount}
                        </td>
                        <td className="ct-table-cell text-right ct-text-muted">
                          {formatAdminDate(new Date(d.distributedAt))}
                        </td>
                        <td className="ct-table-cell text-right mono body-xs ct-text-faint">
                          {d.txHash ? (
                            d.txHash.startsWith("0xMOCK") ? (
                              <span className="ct-text-faint">simulated</span>
                            ) : (
                              `${d.txHash.slice(0, 8)}…`
                            )
                          ) : (
                            <span className="ct-text-faint">—</span>
                          )}
                        </td>
                        <td className="ct-table-cell text-right">
                          {/* B4 — only a REAL on-chain tx hash earns "attested".
                              A simulated `0xMOCK_*` hash is `estimated`; no hash
                              yet (ops-confirmed, not broadcast) is `manual`. */}
                          <span className="inline-flex justify-end">
                            <ProvenanceBadge
                              kind={
                                d.txHash
                                  ? d.txHash.startsWith("0xMOCK")
                                    ? "estimated"
                                    : "attested"
                                  : "manual"
                              }
                            />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SystemPanel>
        )}
      </section>

      {/* Disclaimer */}
      <p className="body-xs ct-text-faint max-w-2xl">
        Distributions shown above are historical records only. They are not a
        commitment to any future distribution. Past distributions are not a
        reliable indicator of future performance or yield.
      </p>
    </div>
  );
}
