// Admin · Customers supervision table.
// Server Component — gated by admin layout (session.role), so no
// redundant auth check here. Reads via the server-only loadCustomers() loader.

import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { cn } from "@/lib/cn";
import { AdminKpiStripPanel } from "@/components/admin/dashboard/admin-kpi-strip-panel";
import { Badge } from "@/components/catalyst/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
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
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-surface-page mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Investor"
          titleAccent="Registry"
          contextLabel="Investor Base"
        />

        {/* Header noir (titre + bouton) → KPI plats → tableau Catalyst, tout
            soudé dans UNE box card (pattern Portfolio "Capital & Yield" /
            "Active Positions"). Composants Catalyst (Table/Badge), zéro scroll
            horizontal — colonnes full-width de gauche à droite. */}
        <section
          className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface-card shadow-sm"
          aria-label="Investors"
        >
          {kpiCells.length > 0 && (
            <AdminKpiStripPanel
              kpis={kpiCells}
              title="Investor Base"
              subtitle={`${total} registered ${total === 1 ? "account" : "accounts"}`}
              action={<CreateInvestorButton />}
              embedded
            />
          )}

          <div className="flex items-center gap-4 border-b border-white/5 p-5">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-[11px] font-bold uppercase leading-none tracking-[0.15em] text-zinc-400">
                Investor Directory
              </h2>
              <p className="text-[12px] tracking-wide text-zinc-500">
                All registered accounts
              </p>
            </div>
            <Badge
              color="zinc"
              className="mt-0.5 shrink-0 self-start bg-white/5 text-[10px]! uppercase tracking-widest"
            >
              {total} total
            </Badge>
          </div>

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
            <Table
              dense
              className="[&_td]:whitespace-normal [&_th]:whitespace-normal"
            >
              <TableHead>
                <TableRow>
                  <TableHeader className="pl-5 bg-transparent text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                    Investor
                  </TableHeader>
                  <TableHeader className="hidden bg-transparent text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 lg:table-cell">
                    Wallet
                  </TableHeader>
                  <TableHeader className="bg-transparent text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                    KYC
                  </TableHeader>
                  <TableHeader className="hidden bg-transparent text-right text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 md:table-cell">
                    Positions
                  </TableHeader>
                  <TableHeader className="bg-transparent text-right text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                    Total principal
                  </TableHeader>
                  <TableHeader className="hidden pr-5 bg-transparent text-right text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 lg:table-cell">
                    Joined
                  </TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {customers.map((c) => (
                  <TableRow
                    key={c.id}
                    className="border-transparent transition-colors hover:bg-white/[0.02]"
                  >
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-1 shrink-0 rounded-full bg-[#A7FB90]" />
                        <Link
                          href={`/admin/customers/${c.id}`}
                          className="min-w-0 truncate text-[14px] font-medium text-white hover:underline"
                        >
                          {c.email}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="hidden font-mono text-[13px] text-zinc-500 lg:table-cell">
                      {truncateWallet(c.walletAddress)}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell className="hidden text-right text-[13px] tabular-nums text-zinc-300 md:table-cell">
                      {c.activePositions}
                    </TableCell>
                    <TableCell className="text-right text-[14px] font-medium tabular-nums text-white">
                      {formatUsdFull(c.totalPrincipalUsdc)}
                    </TableCell>
                    <TableCell className="hidden pr-5 text-right text-[13px] text-zinc-500 lg:table-cell">
                      {formatAdminDate(c.joinedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination controls */}
          {total > 0 && (
            <div className="px-5">
              <AdminPagination
                page={page}
                pageSize={pageSize}
                total={total}
                hasMore={hasMore}
                basePath="/admin/customers"
              />
            </div>
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
