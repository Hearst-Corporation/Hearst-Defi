// Admin · Customers supervision table.
// Server Component — inherits the /admin layout's requireAdmin() gate, so no
// redundant auth check here. Reads via the server-only loadCustomers() loader.

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { KycAction } from "@/components/admin/kyc-action";
import { loadCustomers, type KycStatus } from "@/lib/data/customers";
import { formatAdminDate } from "@/lib/vaults/product-display";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Customers — Hearst Connect",
};

const usdFull = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const KYC_VARIANT: Record<KycStatus, "success" | "warning" | "danger"> = {
  approved: "success",
  pending: "warning",
  rejected: "danger",
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

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Customers"
      />

      <section className="admin-doc-stack admin-doc-stack--actions" aria-label="Customers">
        <h2 className="h2">Directory ({total})</h2>

        {customers.length === 0 ? (
          <EmptySurface
            variant="widget"
            message="No investors yet."
            detail="Investor rows appear here once an account is provisioned with an Investor profile."
            className="min-h-32"
          />
        ) : (
          <Card className="p-0 overflow-hidden" hoverOverlay={false}>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left body-sm">
                <thead>
                  <tr>
                    <th className="w-[30%] stat-label ct-table-header">
                      Email
                    </th>
                    <th className="hidden w-[18%] stat-label ct-table-header lg:table-cell">
                      Wallet
                    </th>
                    <th className="w-[24%] stat-label ct-table-header md:w-[18%]">
                      KYC
                    </th>
                    <th className="hidden w-[14%] stat-label ct-table-header text-right md:table-cell">
                      Active positions
                    </th>
                    <th className="w-[24%] stat-label ct-table-header text-right">
                      Total principal
                    </th>
                    <th className="hidden w-[14%] stat-label ct-table-header lg:table-cell">
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
                        {c.email}
                      </td>
                      <td className="hidden ct-table-cell mono ct-text-muted lg:table-cell">
                        {truncateWallet(c.walletAddress)}
                      </td>
                      <td className="ct-table-cell">
                        <div className="admin-doc-inline-row">
                          <Badge variant={KYC_VARIANT[c.kycStatus]}>
                            {KYC_LABEL[c.kycStatus]}
                          </Badge>
                          <KycAction investorId={c.id} status={c.kycStatus} />
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
          <div className="admin-doc-row-spread pt-2">
            <p className="body-xs ct-text-muted">
              Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
            </p>
            <div className="admin-doc-inline-row">
              {page > 1 && (
                <a
                  href={`/admin/customers?page=${page - 1}&pageSize=${pageSize}`}
                  className="rounded-md border border-(--ct-border-soft) px-3 py-1.5 body-xs ct-text-muted hover:ct-text-strong transition-colors"
                >
                  Previous
                </a>
              )}
              {hasMore && (
                <a
                  href={`/admin/customers?page=${page + 1}&pageSize=${pageSize}`}
                  className="rounded-md border border-(--ct-border-soft) px-3 py-1.5 body-xs ct-text-muted hover:ct-text-strong transition-colors"
                >
                  Next
                </a>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
