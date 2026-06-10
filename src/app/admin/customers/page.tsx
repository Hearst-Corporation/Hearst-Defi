// Admin · Customers supervision table.
// Server Component — inherits the /admin layout's requireAdmin() gate, so no
// redundant auth check here. Reads via the server-only loadCustomers() loader.

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KycAction } from "@/components/admin/kyc-action";
import { loadCustomers, type KycStatus } from "@/lib/data/customers";

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

const joinedFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "2-digit",
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
    <div className="space-y-8">
      <AdminPageHeader
        title="Customers"
        description="Every investor provisioned on the platform: KYC status, active positions and principal under management. Read-only supervision view."
      />

      <section className="space-y-3" aria-label="Customers">
        <h3 className="stat-label">Directory ({total})</h3>

        {customers.length === 0 ? (
          <Card className="p-8">
            <p className="body-sm ct-text-muted">
              No investors yet. Investor rows appear here once an account is
              provisioned with an <code className="mono ct-text-body">Investor</code>{" "}
              profile.
            </p>
          </Card>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--ct-border)]">
                  <th className="stat-label px-5 py-3 font-medium">Email</th>
                  <th className="stat-label px-5 py-3 font-medium">Wallet</th>
                  <th className="stat-label px-5 py-3 font-medium">KYC</th>
                  <th className="stat-label px-5 py-3 text-right font-medium">
                    Active positions
                  </th>
                  <th className="stat-label px-5 py-3 text-right font-medium">
                    Total principal
                  </th>
                  <th className="stat-label px-5 py-3 font-medium">Joined</th>
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
                      <div className="flex items-center gap-2">
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
                      {joinedFmt.format(c.joinedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* Pagination controls */}
        {total > 0 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs ct-text-muted">
              Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <a
                  href={`/admin/customers?page=${page - 1}&pageSize=${pageSize}`}
                  className="rounded-md border border-[var(--ct-border-soft)] px-3 py-1.5 text-xs ct-text-muted hover:ct-text-strong transition-colors"
                >
                  Previous
                </a>
              )}
              {hasMore && (
                <a
                  href={`/admin/customers?page=${page + 1}&pageSize=${pageSize}`}
                  className="rounded-md border border-[var(--ct-border-soft)] px-3 py-1.5 text-xs ct-text-muted hover:ct-text-strong transition-colors"
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
