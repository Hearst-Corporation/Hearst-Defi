import Link from "next/link";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { FixtureVaultPills } from "@/components/admin/fixture-vault-pills";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import {
  adminDistributionsVaultHref,
  resolveFixtureVaultId,
} from "@/lib/vaults/dashboard-scope";
import { formatAdminDate, formatUsdDetailed } from "@/lib/vaults/product-display";
import { listAllVaults, vaultSlug, vaultLabel } from "@/lib/vaults/resolver";
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
      <section className="admin-doc-stack admin-doc-stack--actions">
        <h2 className="h2">History (last 6)</h2>

        {history.length === 0 ? (
          <EmptySurface
            variant="widget"
            message="No distributions yet."
            detail="Confirmed distributions will appear here after multisig approval."
            className="min-h-32"
          />
        ) : (
          <Card className="p-0 overflow-hidden" hoverOverlay={false}>
            <div className="overflow-hidden">
              <table className="w-full table-fixed body-sm tabular">
                <thead>
                  <tr>
                    <th className="w-[28%] text-left ct-table-header stat-label">
                      Vault
                    </th>
                    <th className="w-[16%] text-left ct-table-header stat-label">
                      Period
                    </th>
                    <th className="w-[22%] text-right ct-table-header stat-label">
                      Amount (USDC)
                    </th>
                    <th className="hidden w-[12%] text-right ct-table-header stat-label md:table-cell">
                      Recipients
                    </th>
                    <th className="w-[34%] text-right ct-table-header stat-label md:w-[22%]">
                      Distributed at
                    </th>
                    <th className="hidden text-right ct-table-header stat-label xl:table-cell">
                      Tx hash
                    </th>
                    <th className="hidden text-right ct-table-header stat-label lg:table-cell">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((d) => {
                    const slug = d.vaultRef;
                    const label = slug
                      ? (LEGACY_VAULT_LABELS[slug] ?? vaultLabelBySlug.get(slug) ?? slug)
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
                      <tr key={d.id} className="border-t border-(--ct-border-soft)">
                        <td className="ct-table-cell body-sm ct-text-body truncate">
                          {vaultHref && label ? (
                            <Link
                              href={vaultHref}
                              className="block max-w-full truncate ct-text-accent hover:underline"
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
                        <td className="hidden ct-table-cell text-right ct-text-muted tabular md:table-cell">
                          {d.recipientsCount}
                        </td>
                        <td className="ct-table-cell text-right ct-text-muted">
                          {formatAdminDate(new Date(d.distributedAt))}
                        </td>
                        <td className="hidden ct-table-cell text-right mono body-xs ct-text-faint xl:table-cell">
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
                        <td className="hidden ct-table-cell text-right lg:table-cell">
                          {/* B4 — only a REAL on-chain tx hash earns "attested".
                              A simulated `0xMOCK_*` hash is `estimated`; no hash
                              yet (ops-confirmed, not broadcast) is `manual`. */}
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
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
