// Admin · Customers supervision table.
// Server Component — inherits the /admin layout's requireAdmin() gate, so no
// redundant auth check here. Reads via the server-only loadCustomers() loader.

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
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

      <section className="admin-doc-stack--actions" aria-label="Customers">
        <h3 className="h3">Directory ({total})</h3>

        {customers.length === 0 ? (
          <EmptySurface
            variant="widget"
            message="No investors yet."
            detail="Investor rows appear here once an account is provisioned with an Investor profile."
            className="min-h-32"
          />
        ) : (
          <div className="ct-table-surface">
            <table className="w-full border-collapse text-left body-sm">
              <thead>
                <tr>
                  <th className="ct-table-header px-5 py-3 font-medium ct-text-muted">
                    Email
                  </th>
                  <th className="ct-table-header px-5 py-3 font-medium ct-text-muted">
                    Wallet
                  </th>
                  <th className="ct-table-header px-5 py-3 font-medium ct-text-muted">
                    KYC
                  </th>
                  <th className="ct-table-header px-5 py-3 text-right font-medium ct-text-muted">
                    Active positions
                  </th>
                  <th className="ct-table-header px-5 py-3 text-right font-medium ct-text-muted">
                    Total principal
                  </th>
                  <th className="ct-table-header px-5 py-3 font-medium ct-text-muted">
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[var(--ct-border)] last:border-0"
                  >
                    <td className="px-5 py-3 ct-text-strong">
                      {c.email}
                    </td>
                    <td className="mono px-5 py-3 ct-text-muted">
                      {truncateWallet(c.walletAddress)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="admin-doc-inline-row">
                        <Badge variant={KYC_VARIANT[c.kycStatus]}>
                          {KYC_LABEL[c.kycStatus]}
                        </Badge>
                        <KycAction investorId={c.id} status={c.kycStatus} />
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums ct-text-body">
                      {c.activePositions}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums ct-text-strong">
                      {usdFull.format(c.totalPrincipalUsdc)}
                    </td>
                    <td className="px-5 py-3 ct-text-muted">
                      {formatAdminDate(c.joinedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                  className="rounded-md border border-[var(--ct-border-soft)] px-3 py-1.5 body-xs ct-text-muted hover:ct-text-strong transition-colors"
                >
                  Previous
                </a>
              )}
              {hasMore && (
                <a
                  href={`/admin/customers?page=${page + 1}&pageSize=${pageSize}`}
                  className="rounded-md border border-[var(--ct-border-soft)] px-3 py-1.5 body-xs ct-text-muted hover:ct-text-strong transition-colors"
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
