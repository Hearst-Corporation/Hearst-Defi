import Link from "next/link";

import { loadCustomers, loadOrphanSubmissions } from "@/lib/data/customers";
import { formatAdminDate, formatUsdFull } from "@/lib/vaults/product-display";
import { truncateWallet } from "@/lib/wallet-display";
import { PageHeader, PageLayout, Panel, Section } from "@/views/_shared/layout";
import {
  Badge,
  Button,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui";

export async function AdminCustomersView() {
  const [result, orphans] = await Promise.all([
    loadCustomers(1, 50),
    loadOrphanSubmissions(),
  ]);
  const investors = result.data;

  return (
    <PageLayout>
      <PageHeader
        title="Investors"
        description={`${result.total} investor record(s) on file.`}
        actions={<Button variant="secondary">Create investor</Button>}
      />

      <Section title="Investor directory">
        <Panel>
          {investors.length === 0 ? (
            <EmptyState title="No investors yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>KYC</TableHead>
                  <TableHead>Deployed</TableHead>
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
                      {inv.totalPrincipalUsdc > 0
                        ? formatUsdFull(inv.totalPrincipalUsdc)
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
        </Panel>
      </Section>

      {orphans.length > 0 ? (
        <Section title="Pending submissions">
          <Panel>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orphans.map((o) => (
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
