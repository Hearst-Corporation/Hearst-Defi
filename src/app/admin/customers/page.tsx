// Admin · Customers supervision table.
// Server Component — gated by admin layout (session.role), so no
// redundant auth check here. Reads via the server-only loadCustomers() loader.

import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { cn } from "@/lib/cn";
import { AdminKpiStripPanel } from "@/components/admin/dashboard/admin-kpi-strip-panel";
import { EmptySurface } from "@/components/ui/empty-surface";
import { KycAction } from "@/components/admin/kyc-action";
import { CreateInvestorButton } from "@/components/admin/customer/create-investor-button";
import {
  AdminTable,
  AdminPagination,
} from "@/components/admin/admin-table-layout";
import { loadCustomers, loadOrphanSubmissions, type KycStatus } from "@/lib/data/customers";
import { buildCustomersKpiStrip } from "@/lib/admin/customers-kpi-strip";
import { formatAdminDate, formatUsdFull } from "@/lib/vaults/product-display";
import { truncateWallet } from "@/lib/wallet-display";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Investors — Hearst Connect",
};

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

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const { page: rawPage, pageSize: rawPageSize } = await searchParams;
  const page = Math.max(1, Number(rawPage ?? 1));
  const pageSize = Math.min(Math.max(Number(rawPageSize ?? 50), 1), 100);

  const [result, orphanSubmissions] = await Promise.all([
    loadCustomers(page, pageSize),
    loadOrphanSubmissions(),
  ]);
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
          <AdminTable
            data={customers}
            headers={[
              "Email",
              <span key="wallet" className="hidden lg:inline">Wallet</span>,
              "KYC",
              <span key="positions" className="hidden md:inline">Active positions</span>,
              <span key="principal" className="text-right">Total principal</span>,
              <span key="joined" className="hidden lg:inline">Joined</span>,
            ]}
            colWidths={[
              "w-[30%]",
              "hidden w-[18%] lg:table-cell",
              "w-[24%] md:w-[18%]",
              "hidden w-[14%] text-right md:table-cell",
              "w-[24%] text-right",
              "hidden w-[14%] lg:table-cell",
            ]}
            renderRow={(c) => (
              <>
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
                    <span className="inline-flex items-center gap-(--ct-space-1_5) body-sm">
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
                  {formatUsdFull(c.totalPrincipalUsdc)}
                </td>
                <td className="hidden ct-table-cell ct-text-muted lg:table-cell">
                  {formatAdminDate(c.joinedAt)}
                </td>
              </>
            )}
          />
        )}

        {/* Pagination controls */}
        {total > 0 && (
          <AdminPagination
            page={page}
            pageSize={pageSize}
            total={total}
            hasMore={hasMore}
            basePath="/admin/customers"
          />
        )}
      </section>

      {orphanSubmissions.length > 0 && (
        <section
          className="admin-doc-stack admin-crm-view"
          aria-label="Pending submissions"
        >
          <h2 className="h2">Pending submissions ({orphanSubmissions.length})</h2>
          <p className="body-xs ct-text-muted">
            Qualification forms submitted but not yet linked to an account — e.g.
            filled before sign-up, or an auto-create that did not complete.
            Provision an account with the matching email to link the submission
            and calibrate the assistant.
          </p>
          <AdminTable
            data={orphanSubmissions}
            headers={[
              "Email",
              "Name",
              <span key="source" className="hidden md:inline">Source</span>,
              <span key="submitted" className="text-right">Submitted</span>,
            ]}
            colWidths={[
              "w-[34%]",
              "w-[26%]",
              "hidden w-[20%] md:table-cell",
              "w-[20%] text-right",
            ]}
            renderRow={(s) => (
              <>
                <td className="ct-table-cell truncate ct-text-strong">
                  {s.email ?? "—"}
                </td>
                <td className="ct-table-cell truncate ct-text-muted">
                  {[s.firstName, s.lastName].filter(Boolean).join(" ") || "—"}
                </td>
                <td className="hidden ct-table-cell ct-text-muted md:table-cell">
                  {s.source}
                </td>
                <td className="ct-table-cell text-right ct-text-muted">
                  {formatAdminDate(s.submittedAt)}
                </td>
              </>
            )}
          />
        </section>
      )}
    </>
  );
}
