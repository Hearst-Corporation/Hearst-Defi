// Admin · Customers supervision table.
// Server Component — gated by admin layout (session.role), so no
// redundant auth check here. Reads via the server-only loadCustomers() loader.

import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { cn } from "@/lib/cn";
import { AdminKpiStripPanel } from "@/components/admin/dashboard/admin-kpi-strip-panel";
import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { KycAction } from "@/components/admin/kyc-action";
import { CreateInvestorButton } from "@/components/admin/customer/create-investor-button";
import { loadCustomers, type KycStatus } from "@/lib/data/customers";
import { buildCustomersKpiStrip } from "@/lib/admin/customers-kpi-strip";
import { formatAdminDate } from "@/lib/vaults/product-display";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Investors — Hearst Connect",
};

const usdFull = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const KYC_DOT: Record<KycStatus, string> = {
  approved: "ct-status-dot-success",
  pending: "ct-status-dot-warning",
  rejected: "ct-status-dot-danger",
};

const KYC_LABEL: Record<KycStatus, string> = {
  approved: "Approved",
  pending: "Pending",
  rejected: "Rejected",
};

/** Short, middle-truncated wallet address (0x1234…abcd) or em dash. */
function truncateWallet(wallet: string | null): string {
  if (!wallet) return "—";
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const { page: rawPage, pageSize: rawPageSize } = await searchParams;
  const page = Math.max(1, Number(rawPage ?? 1));
  const pageSize = Math.min(Math.max(Number(rawPageSize ?? 50), 1), 100);

  const result = await loadCustomers(page, pageSize);
  const { data: customers, total, hasMore } = result;

  const kpiCells = buildCustomersKpiStrip(customers, total);

  return (
    <>
      <AdminPageHeader
        titleLead="Investor"
        titleAccent="Registry"
        contextLabel="Investor Base"
      />

      {kpiCells.length > 0 && <AdminKpiStripPanel kpis={kpiCells} />}

      <div className="admin-doc-toolbar">
        <div className="admin-doc-inline-row admin-doc-inline-row--actions">
          <CreateInvestorButton />
        </div>
      </div>

      <section className="admin-doc-stack admin-crm-view" aria-label="Investors">
        <h2 className="h2">Investor directory ({total})</h2>

        {customers.length === 0 ? (
          <EmptySurface
            variant="widget"
            message="No investors yet."
            detail="Provision an account with the New investor button — it creates the User and Investor records. Sign-in stays disabled until the password reset flow is completed."
            className="min-h-32"
          >
            <div className="admin-doc-stack admin-doc-stack--tight">
              <CreateInvestorButton />
            </div>
          </EmptySurface>
        ) : (
          <Card className="p-0 overflow-hidden" hoverOverlay={false}>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left body-sm">
                <thead>
                  <tr>
                    <th className="w-[30%] stat-label ct-table-header whitespace-nowrap">
                      Email
                    </th>
                    <th className="hidden w-[18%] stat-label ct-table-header whitespace-nowrap lg:table-cell">
                      Wallet
                    </th>
                    <th className="w-[24%] stat-label ct-table-header whitespace-nowrap md:w-[18%]">
                      KYC
                    </th>
                    <th className="hidden w-[14%] stat-label ct-table-header whitespace-nowrap text-right md:table-cell">
                      Active positions
                    </th>
                    <th className="w-[24%] stat-label ct-table-header whitespace-nowrap text-right">
                      Total principal
                    </th>
                    <th className="hidden w-[14%] stat-label ct-table-header whitespace-nowrap lg:table-cell">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-(--ct-border-soft) last:border-0"
                    >
                      <td className="ct-table-cell truncate ct-text-strong">
                        <Link href={`/admin/customers/${c.id}`} className="hover:underline">
                          {c.email}
                        </Link>
                      </td>
                      <td className="hidden ct-table-cell mono ct-text-muted lg:table-cell">
                        {truncateWallet(c.walletAddress)}
                      </td>
                      <td className="ct-table-cell">
                        <div className="admin-doc-stack admin-doc-stack--micro">
                          <span className="inline-flex items-center gap-[var(--ct-space-1_5)] body-sm">
                            <span
                              aria-hidden
                              className={cn("ct-dot", KYC_DOT[c.kycStatus])}
                            />
                            <span
                              className={cn(
                                "ct-text-muted",
                                c.kycStatus === "rejected" && "ct-status-danger",
                              )}
                            >
                              {KYC_LABEL[c.kycStatus]}
                            </span>
                          </span>
                          <div className="admin-doc-inline-row admin-doc-inline-row--tight">
                            <KycAction investorId={c.id} status={c.kycStatus} />
                          </div>
                        </div>
                      </td>
                      <td className="hidden ct-table-cell text-right tabular-nums ct-text-body md:table-cell">
                        {c.activePositions}
                      </td>
                      <td className="ct-table-cell text-right tabular-nums ct-text-strong">
                        {usdFull.format(c.totalPrincipalUsdc)}
                      </td>
                      <td className="hidden ct-table-cell ct-text-muted lg:table-cell">
                        {formatAdminDate(c.joinedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Pagination controls */}
        {total > 0 && (
          <div className="admin-doc-stack admin-doc-stack--compact border-t border-(--ct-border-soft) py-[var(--ct-space-4)]">
            <div className="admin-doc-row-spread">
              <p className="body-xs ct-text-muted">
                Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
              </p>
              <div className="admin-doc-inline-row">
                {page > 1 && (
                  <a
                    href={`/admin/customers?page=${page - 1}&pageSize=${pageSize}`}
                    className="rounded-md border border-(--ct-border-soft) px-[var(--ct-space-3)] py-[var(--ct-space-1_5)] body-xs ct-text-muted hover:ct-text-strong transition-colors ease-[var(--ct-ease)]"
                  >
                    Previous
                  </a>
                )}
                {hasMore && (
                  <a
                    href={`/admin/customers?page=${page + 1}&pageSize=${pageSize}`}
                    className="rounded-md border border-(--ct-border-soft) px-[var(--ct-space-3)] py-[var(--ct-space-1_5)] body-xs ct-text-muted hover:ct-text-strong transition-colors ease-[var(--ct-ease)]"
                  >
                    Next
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
