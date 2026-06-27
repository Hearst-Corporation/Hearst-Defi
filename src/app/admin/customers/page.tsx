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

// KYC chip chrome — bento canon (matches the eligibility chip on the invest
// flow): tinted border + fill + text, single accent green for the approved
// state. Provenance/status honesty preserved: each verdict keeps its own color.
const KYC_CHIP: Record<KycStatus, string> = {
  approved: "border-[#A7FB90]/30 bg-[#A7FB90]/10 text-[#A7FB90]",
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  rejected: "border-red-500/30 bg-red-500/10 text-red-400",
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
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Investor"
          titleAccent="Registry"
          contextLabel="Investor Base"
        />

        {kpiCells.length > 0 && <AdminKpiStripPanel kpis={kpiCells} />}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <CreateInvestorButton />
        </div>

        <section className="flex flex-col gap-4" aria-label="Investors">
          <h2 className="text-[15px] font-semibold tracking-tight text-white">
            Investor directory ({total})
          </h2>

          {customers.length === 0 ? (
            <EmptySurface
              variant="widget"
              message="No investors yet."
              detail="Provision an account with the New investor button — it creates the User and Investor records. Sign-in stays disabled until the password reset flow is completed."
              className="min-h-32"
            >
              <div className="flex flex-col gap-3">
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
                  <td className="px-5 py-3 truncate text-[13px] font-medium text-white">
                    <Link href={`/admin/customers/${c.id}`} className="hover:underline">
                      {c.email}
                    </Link>
                  </td>
                  <td className="hidden px-5 py-3 font-mono text-[13px] text-zinc-500 lg:table-cell">
                    {truncateWallet(c.walletAddress)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-col items-start gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          KYC_CHIP[c.kycStatus],
                        )}
                      >
                        {KYC_LABEL[c.kycStatus]}
                      </span>
                      <KycAction investorId={c.id} status={c.kycStatus} />
                    </div>
                  </td>
                  <td className="hidden px-5 py-3 text-right text-[13px] tabular-nums text-zinc-300 md:table-cell">
                    {c.activePositions}
                  </td>
                  <td className="px-5 py-3 text-right text-[13px] font-medium tabular-nums text-white">
                    {formatUsdFull(c.totalPrincipalUsdc)}
                  </td>
                  <td className="hidden px-5 py-3 text-[13px] text-zinc-500 lg:table-cell">
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
            className="flex flex-col gap-4"
            aria-label="Pending submissions"
          >
            <h2 className="text-[15px] font-semibold tracking-tight text-white">
              Pending submissions ({orphanSubmissions.length})
            </h2>
            <p className="text-[12px] leading-relaxed text-zinc-500">
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
                  <td className="px-5 py-3 truncate text-[13px] font-medium text-white">
                    {s.email ?? "—"}
                  </td>
                  <td className="px-5 py-3 truncate text-[13px] text-zinc-500">
                    {[s.firstName, s.lastName].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="hidden px-5 py-3 text-[13px] text-zinc-500 md:table-cell">
                    {s.source}
                  </td>
                  <td className="px-5 py-3 text-right text-[13px] text-zinc-500">
                    {formatAdminDate(s.submittedAt)}
                  </td>
                </>
              )}
            />
          </section>
        )}
      </div>
    </div>
  );
}
