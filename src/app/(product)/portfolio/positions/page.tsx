// Portfolio › Positions — full list of the investor's vault positions, bound to
// real data (loadPortfolio) on the DS canon (Catalyst Table + canon tokens).

import Link from "next/link";

import { Badge } from "@/components/catalyst/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { PortfolioLeafHeader } from "@/components/portfolio/portfolio-leaf-header";
import { loadPortfolio, POSITION_STATUS_CONFIG } from "@/lib/data/portfolio";
import { formatApyRange } from "@/lib/format/apy";
import { formatAdminDate, formatUsdFull } from "@/lib/vaults/product-display";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Positions",
  description: "Your active vault positions",
};

const TABLE_HEAD = "bg-transparent ct-bento-label";
const ROW =
  "border-transparent transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)]";

function apyLabel(low: number | null, high: number | null): string {
  if (low === null || high === null) return "—";
  return formatApyRange({ low, high });
}

export default async function PositionsPage() {
  const { positions } = await loadPortfolio();
  const activeCount = positions.filter((p) => p.status === "active").length;

  return (
    <div className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page [--gutter:theme(spacing.8)] mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <PortfolioLeafHeader
          titleLead="Vault"
          titleAccent="Positions"
          kicker="DEPLOYED CAPITAL"
          trailing={
            activeCount > 0 ? (
              <Badge color="zinc" className="uppercase">
                {activeCount} active
              </Badge>
            ) : null
          }
        />

        <section
          className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm overflow-hidden flex flex-col"
          aria-label="Positions"
        >
          {positions.length > 0 ? (
            <Table
              dense
              className="[--gutter:0px] max-w-full [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap"
            >
              <TableHead>
                <TableRow>
                  <TableHeader className={`${TABLE_HEAD} pl-5`}>Vault</TableHeader>
                  <TableHeader className={`${TABLE_HEAD} text-center`}>
                    Status
                  </TableHeader>
                  <TableHeader className={`${TABLE_HEAD} text-right`}>
                    Principal
                  </TableHeader>
                  <TableHeader className={`${TABLE_HEAD} text-right`}>
                    Value
                  </TableHeader>
                  <TableHeader className={`${TABLE_HEAD} text-right`}>
                    Target APY
                  </TableHeader>
                  <TableHeader className={`${TABLE_HEAD} pr-5 text-right`}>
                    Subscribed
                  </TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {positions.map((p) => (
                  <TableRow key={p.id} className={ROW}>
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-3">
                        <div
                          aria-hidden="true"
                          className="h-7 w-1 shrink-0 rounded-full bg-[var(--ct-accent)]"
                        />
                        <Link
                          href={`/portfolio/${p.id}`}
                          className="ct-metric-value min-w-0 truncate hover:underline"
                        >
                          {p.vaultName ?? "Hearst Yield Vault"}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        color={
                          p.status === "active"
                            ? "green"
                            : p.status === "matured"
                              ? "amber"
                              : "zinc"
                        }
                        className="uppercase"
                      >
                        {POSITION_STATUS_CONFIG[p.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="ct-metric-caption text-right">
                      {formatUsdFull(p.principalUsdc)}
                    </TableCell>
                    <TableCell className="ct-metric-value text-right">
                      {formatUsdFull(p.valueUsdc)}
                    </TableCell>
                    <TableCell className="ct-metric-value text-right text-[var(--ct-accent)]">
                      {apyLabel(p.apyLow, p.apyHigh)}
                    </TableCell>
                    <TableCell className="ct-metric-caption pr-5 text-right">
                      {formatAdminDate(p.subscribedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-10 text-center">
              <p className="ct-metric-caption">
                No positions yet. Once you subscribe to a vault, your deployed
                capital appears here.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
