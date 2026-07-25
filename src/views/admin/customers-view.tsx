import Link from "next/link";

import { CreateInvestorButton } from "@/components/admin/customer/create-investor-button";
import { AdminPagination } from "@/components/admin/admin-table-layout";
import { FORM_SURFACE } from "@/components/admin/admin-page-shell";
import { buildCustomersKpiStrip } from "@/lib/admin/customers-kpi-strip";
import {
  loadCustomers,
  loadCustomersAggregates,
  loadOrphanSubmissions,
} from "@/lib/data/customers";
import { formatAdminDate, formatUsdFull } from "@/lib/vaults/product-display";
import { truncateWallet } from "@/lib/wallet-display";
import { PageHeader, PageLayout, Panel, Section } from "@/views/_shared/layout";
import {
  Badge,
  EmptyState,
  Kpi,
  KpiGrid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui";

const PAGE_SIZE = 50;

export async function AdminCustomersView({ page = 1 }: { page?: number }) {
  const [result, orphans, aggregates] = await Promise.all([
    loadCustomers(page, PAGE_SIZE),
    loadOrphanSubmissions(),
    loadCustomersAggregates(),
  ]);
  const investors = result.data;
  const kpis = buildCustomersKpiStrip(aggregates);

  return (
    <PageLayout>
      <PageHeader
        title="Investors"
        description={`${result.total} investor record(s) on file.`}
        actions={<CreateInvestorButton />}
      />

      {kpis.length > 0 ? (
        <KpiGrid>
          {kpis.map((kpi) => (
            <Panel key={kpi.label}>
              <div className={FORM_SURFACE}>
                <Kpi
                  label={kpi.label}
                  value={kpi.value}
                  hint={kpi.sublabel}
                  provenance={kpi.provenance}
                />
              </div>
            </Panel>
          ))}
        </KpiGrid>
      ) : null}

      <Section title="Investor directory">
        <Panel>
          {investors.length === 0 ? (
            <EmptyState
              title={
                result.total === 0
                  ? "No investors yet"
                  : "No investors on this page"
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>KYC</TableHead>
                  <TableHead>Active principal</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {investors.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          inv.kycStatus === "approved"
                            ? "success"
                            : inv.kycStatus === "pending"
                              ? "warning"
                              : "default"
                        }
                      >
                        {inv.kycStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {inv.activePrincipalUsdc > 0
                        ? formatUsdFull(inv.activePrincipalUsdc)
                        : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {inv.walletAddress
                        ? truncateWallet(inv.walletAddress)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/customers/${inv.id}`}
                        className="text-xs text-accent hover:underline"
                      >
                        Open
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {result.total > 0 ? (
            <div className="px-5">
              <AdminPagination
                page={result.page}
                pageSize={result.pageSize}
                total={result.total}
                hasMore={result.hasMore}
                basePath="/admin/customers"
              />
            </div>
          ) : null}
        </Panel>
      </Section>

      {orphans.total > 0 ? (
        <Section
          title="Pending submissions"
          description={`Showing ${orphans.rows.length} of ${orphans.total} unmatched submission(s).`}
        >
          <Panel>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orphans.rows.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>{o.email}</TableCell>
                    <TableCell>{formatAdminDate(o.submittedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        </Section>
      ) : null}
    </PageLayout>
  );
}
