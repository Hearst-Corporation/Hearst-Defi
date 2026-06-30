// Admin · Customers supervision table.
// Server Component — gated by admin layout (session.role), so no
// redundant auth check here. Reads via the server-only loadCustomers() loader.

import Link from "next/link";

import { AdminPageShell } from "@/components/admin/admin-page-shell";
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
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { KycAction } from "@/components/admin/kyc-action";
import { KycStepper } from "@/components/admin/customer/kyc-stepper";
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

// Shared table class literals — centralized so the two list tables (Investor
// Directory + Pending submissions) stay in lockstep instead of repeating the
// same strings inline. Pure de-duplication, zero rendering change.
const TABLE_HEAD = "bg-transparent ct-bento-label";
// Wrapper keeps Catalyst's own overflow-x-auto → table scrolls LOCALLY in the
// card when the assistant rail narrows the slot (no global overflow, no bleed).
const TABLE_WRAP = "max-w-full [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap";
const ROW =
  "border-transparent transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)]";
// Section card shell — shared by the two list cards (Investor Directory +
// Pending submissions) so they stay in lockstep. Pure de-duplication.
const CARD =
  "flex flex-col overflow-hidden rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)]";

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
    <AdminPageShell
      titleLead="Investor"
      titleAccent="Registry"
      contextLabel="Investor Base"
      headerActions={<CreateInvestorButton />}
    >
        {/* Header noir (KPI) → sous-header → tableau Catalyst, tout soudé dans
            UNE box card (pattern Portfolio "Capital & Yield" / "Active
            Positions"). Le CTA "New investor" vit dans le header de page. */}
        <section className={CARD} aria-label="Investors">
          {kpiCells.length > 0 && (
            <AdminKpiStripPanel
              kpis={kpiCells}
              title="Investor Base"
              subtitle={`${total} registered ${total === 1 ? "account" : "accounts"}`}
              embedded
            />
          )}

          <div className="flex items-center gap-4 border-b border-[var(--ct-border-soft)] p-5">
            <div className="flex flex-col gap-1">
              <h2 className="ct-section-title">Investor Directory</h2>
              <p className="ct-metric-caption">All registered accounts</p>
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
            <Table className={TABLE_WRAP}>
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
                  <TableRow key={c.id} className={ROW}>
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-3">
                        <InvestorAccentBar status={c.kycStatus} />
                        <Link
                          href={`/admin/customers/${c.id}`}
                          className="ct-metric-value min-w-0 truncate hover:underline"
                        >
                          {c.email}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell
                      className={`ct-metric-caption hidden text-center font-mono lg:table-cell`}
                    >
                      {truncateWallet(c.walletAddress)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-center gap-1.5">
                        <KycStepper status={c.kycStatus} />
                        <KycAction investorId={c.id} status={c.kycStatus} />
                      </div>
                    </TableCell>
                    <TableCell
                      className={`ct-metric-caption hidden text-center tabular-nums md:table-cell`}
                    >
                      {c.activePositions}
                    </TableCell>
                    <TableCell className="ct-metric-value text-center">
                      {formatUsdFull(c.totalPrincipalUsdc)}
                    </TableCell>
                    <TableCell
                      className={`ct-metric-caption hidden pr-5 text-center lg:table-cell`}
                    >
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
          <section className={CARD} aria-label="Pending submissions">
            <div className="flex flex-col gap-1.5 border-b border-[var(--ct-border-soft)] p-5">
              <h2 className="ct-section-title">
                Pending submissions ({orphanSubmissions.length})
              </h2>
              <p className="ct-metric-caption leading-relaxed">
                Qualification forms submitted but not yet linked to an account —
                filled before sign-up, or an auto-create that did not complete.
                Provision an account with the matching email to link it.
              </p>
            </div>
            <Table dense className={TABLE_WRAP}>
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
                  <TableRow key={s.id} className={ROW}>
                    <TableCell className="ct-metric-value pl-5 truncate">
                      {s.email ?? "—"}
                    </TableCell>
                    <TableCell className="ct-metric-caption truncate text-center">
                      {[s.firstName, s.lastName].filter(Boolean).join(" ") || "—"}
                    </TableCell>
                    <TableCell className="ct-metric-caption hidden text-center md:table-cell">
                      {s.source}
                    </TableCell>
                    <TableCell className="ct-metric-caption pr-5 text-center">
                      {formatAdminDate(s.submittedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}
    </AdminPageShell>
  );
}
