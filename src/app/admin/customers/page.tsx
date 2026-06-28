// Admin · Customers supervision table.
// Server Component — gated by admin layout (session.role), so no
// redundant auth check here. Reads via the server-only loadCustomers() loader.

import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
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
import { KycStatusBadge } from "@/components/admin/customer/kyc-status-badge";
import { InvestorAccentBar } from "@/components/admin/customer/investor-accent-bar";
import { CreateInvestorButton } from "@/components/admin/customer/create-investor-button";
import { AdminPagination } from "@/components/admin/admin-table-layout";
import { loadCustomers, loadOrphanSubmissions } from "@/lib/data/customers";
import { buildCustomersKpiStrip } from "@/lib/admin/customers-kpi-strip";
import { formatAdminDate, formatUsdFull } from "@/lib/vaults/product-display";
import { truncateWallet } from "@/lib/wallet-display";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Investors — Hearst Connect",
};

const TABLE_HEAD = "bg-transparent ct-bento-label";

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
    <div className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8">
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
          className="flex flex-col overflow-hidden rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm"
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

          <div className="flex items-center gap-4 border-b border-[var(--ct-border-soft)] p-5">
            <div className="flex flex-col gap-1">
              <h2 className="ct-bento-label text-[var(--ct-text-body)]">
                Investor Directory
              </h2>
              <p className="text-[12px] tracking-wide text-[var(--ct-text-muted)]">
                All registered accounts
              </p>
            </div>
            <Badge color="zinc" className="mt-0.5 shrink-0 self-start uppercase">
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
            // Slot-aware contract: the Catalyst wrapper keeps its own
            // `overflow-x-auto`, so when the assistant rail is open and the
            // center slot is narrow the table scrolls LOCALLY instead of
            // bleeding under the rail. `bleed` dropped so the wrapper's
            // `-mx-(--gutter)` no longer pulls the edges past the card. No
            // `overflow-x-visible!` (it defeated the local scroll), no
            // `[&_table]:w-full` (it fought the table's intrinsic min width).
            <Table
              dense
              className="max-w-full [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap"
            >
              <TableHead>
                <TableRow>
                  <TableHeader className={`${TABLE_HEAD} pl-5`}>
                    Investor
                  </TableHeader>
                  <TableHeader
                    className={`${TABLE_HEAD} hidden text-center lg:table-cell`}
                  >
                    Wallet
                  </TableHeader>
                  <TableHeader className={`${TABLE_HEAD} text-center`}>
                    KYC
                  </TableHeader>
                  <TableHeader
                    className={`${TABLE_HEAD} hidden text-center md:table-cell`}
                  >
                    Positions
                  </TableHeader>
                  <TableHeader className={`${TABLE_HEAD} text-center`}>
                    Total principal
                  </TableHeader>
                  <TableHeader
                    className={`${TABLE_HEAD} hidden pr-5 text-center lg:table-cell`}
                  >
                    Joined
                  </TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {customers.map((c) => (
                  <TableRow
                    key={c.id}
                    className="border-transparent transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)]"
                  >
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-3">
                        <InvestorAccentBar />
                        <Link
                          href={`/admin/customers/${c.id}`}
                          className="min-w-0 truncate text-sm font-medium text-[var(--ct-text-strong)] hover:underline"
                        >
                          {c.email}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-center font-mono text-[13px] text-[var(--ct-text-muted)] lg:table-cell">
                      {truncateWallet(c.walletAddress)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2.5">
                        <KycStatusBadge status={c.kycStatus} />
                        <KycAction investorId={c.id} status={c.kycStatus} />
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-center text-[13px] tabular-nums text-[var(--ct-text-body)] md:table-cell">
                      {c.activePositions}
                    </TableCell>
                    <TableCell className="text-center text-sm font-medium tabular-nums text-[var(--ct-text-strong)]">
                      {formatUsdFull(c.totalPrincipalUsdc)}
                    </TableCell>
                    <TableCell className="hidden pr-5 text-center text-[13px] text-[var(--ct-text-muted)] lg:table-cell">
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
            className="flex flex-col overflow-hidden rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm"
            aria-label="Pending submissions"
          >
            <div className="flex flex-col gap-1.5 border-b border-[var(--ct-border-soft)] p-5">
              <h2 className="ct-bento-label text-[var(--ct-text-body)]">
                Pending submissions ({orphanSubmissions.length})
              </h2>
              <p className="text-[12px] leading-relaxed text-[var(--ct-text-muted)]">
                Qualification forms submitted but not yet linked to an account —
                filled before sign-up, or an auto-create that did not complete.
                Provision an account with the matching email to link it.
              </p>
            </div>
            <Table
              dense
              className="max-w-full [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap"
            >
              <TableHead>
                <TableRow>
                  <TableHeader className={`${TABLE_HEAD} pl-5`}>
                    Email
                  </TableHeader>
                  <TableHeader className={`${TABLE_HEAD} text-center`}>
                    Name
                  </TableHeader>
                  <TableHeader
                    className={`${TABLE_HEAD} hidden text-center md:table-cell`}
                  >
                    Source
                  </TableHeader>
                  <TableHeader className={`${TABLE_HEAD} pr-5 text-center`}>
                    Submitted
                  </TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {orphanSubmissions.map((s) => (
                  <TableRow
                    key={s.id}
                    className="border-transparent transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)]"
                  >
                    <TableCell className="pl-5 truncate text-[13px] font-medium text-[var(--ct-text-strong)]">
                      {s.email ?? "—"}
                    </TableCell>
                    <TableCell className="truncate text-center text-[13px] text-[var(--ct-text-muted)]">
                      {[s.firstName, s.lastName].filter(Boolean).join(" ") || "—"}
                    </TableCell>
                    <TableCell className="hidden text-center text-[13px] text-[var(--ct-text-muted)] md:table-cell">
                      {s.source}
                    </TableCell>
                    <TableCell className="pr-5 text-center text-[13px] text-[var(--ct-text-muted)]">
                      {formatAdminDate(s.submittedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}
      </div>
    </div>
  );
}
