// Admin · Audit log read surface.
// Server Component — gated by admin layout (session.role).
// Filterable via plain GET <form>; no client JS required.
//
// Presentation built on the purchased Catalyst / Tailwind Plus primitives
// (Table, Input, Button, Badge) — NOT free ad-hoc Tailwind. Pages compose
// components; the dark theme + accent live inside the Catalyst components.

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminKpiStripPanel } from "@/components/admin/dashboard/admin-kpi-strip-panel";
import { BentoPageShell, BentoPanel, BentoHeader, BentoLabel } from "@/components/ui/bento";
import { Badge } from "@/components/catalyst/badge";
import { Button } from "@/components/catalyst/button";
import { Input } from "@/components/catalyst/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { getAdminAuditLog } from "@/lib/admin/audit";
import { buildAuditKpiStrip } from "@/lib/admin/audit-kpi-strip";
import { cn } from "@/lib/cn";
import { truncateWallet } from "@/lib/wallet-display";
import { formatAdminAuditTimestamp } from "@/lib/vaults/product-display";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Audit Log — Hearst Connect",
};

/** Destructive / high-attention actions get a colored Catalyst badge; routine events stay muted. */
function actionIsAlert(action: string): boolean {
  return (
    action.includes("pause") ||
    action.includes("reject") ||
    action.includes("delete")
  );
}

function AuditActionLabel({ action }: { action: string }) {
  const alert = actionIsAlert(action);

  return (
    <Badge color={alert ? "rose" : "zinc"} className="font-mono">
      {action}
    </Badge>
  );
}

function DiffBlock({ label, value, muted }: { label: string; value: unknown; muted?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="ct-bento-label">{label}</p>
      <pre
        className={cn(
          "ct-bento-code-block",
          muted && "ct-bento-code-block--muted",
        )}
      >
        {value === null ? "null" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    entityType?: string;
    actor?: string;
    action?: string;
  }>;
}) {
  const { entityType, actor, action } = await searchParams;

  const entries = await getAdminAuditLog({
    entityType: entityType?.trim() || undefined,
    actorWallet: actor?.trim() || undefined,
    action: action?.trim() || undefined,
  });

  const hasFilters =
    Boolean(entityType?.trim()) ||
    Boolean(actor?.trim()) ||
    Boolean(action?.trim());

  const kpiStrip = buildAuditKpiStrip(entries);

  return (
    <BentoPageShell>
      <AdminPageHeader
        titleLead="Audit"
        titleAccent="Log"
        contextLabel="Compliance"
      />

      {kpiStrip.length > 0 && <AdminKpiStripPanel kpis={kpiStrip} />}

      {/* Filter bar — plain GET form, zero client JS. Catalyst Input + Button. */}
      <BentoPanel aria-label="Filters">
        <BentoHeader title="Filter audit log" />
        <form method="get" className="flex flex-wrap items-end gap-3 p-5">
          <fieldset className="contents">
            <legend className="sr-only">Filter audit log</legend>

            <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
              <BentoLabel>Entity type</BentoLabel>
              <Input
                name="entityType"
                defaultValue={entityType ?? ""}
                placeholder="e.g. VaultDeployment"
              />
            </label>

            <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
              <BentoLabel>Actor wallet</BentoLabel>
              <Input
                name="actor"
                defaultValue={actor ?? ""}
                placeholder="0x…"
                className="font-mono"
              />
            </label>

            <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
              <BentoLabel>Action</BentoLabel>
              <Input
                name="action"
                defaultValue={action ?? ""}
                placeholder="e.g. vault.approve"
              />
            </label>

            <Button type="submit" outline>
              Filter
            </Button>

            {hasFilters && (
              <Button href="/admin/audit" plain>
                Clear
              </Button>
            )}
          </fieldset>
        </form>
      </BentoPanel>

      {/* Results */}
      <section className="flex flex-col gap-4" aria-label="Audit entries">
        <h2 className="text-[13px] font-semibold tracking-tight ct-text-strong">
          {hasFilters ? "Filtered results" : "Recent events"}{" "}
          <span className="ct-text-muted tabular-nums">({entries.length})</span>
        </h2>

        {entries.length === 0 ? (
          <BentoPanel className="items-center justify-center px-5 py-12 text-center">
            <p className="text-[13px] ct-text-secondary">
              {hasFilters
                ? "No admin activity matches the current filter."
                : "No admin activity recorded yet."}
            </p>
            {hasFilters ? (
              <p className="mt-1.5 max-w-sm text-[12px] ct-text-faint">
                Adjust the criteria above or clear all filters to see the full
                log.
              </p>
            ) : null}
          </BentoPanel>
        ) : (
          <BentoPanel className="px-5 [--gutter:--spacing(5)]">
            <Table dense grid aria-label="Audit entries">
              <TableHead>
                <TableRow>
                  <TableHeader>When</TableHeader>
                  <TableHeader>Actor</TableHeader>
                  <TableHeader>Action</TableHeader>
                  <TableHeader className="hidden lg:table-cell">Entity</TableHeader>
                  <TableHeader>Details</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    {/* When */}
                    <TableCell className="align-top font-mono text-[12px] ct-text-muted">
                      {formatAdminAuditTimestamp(entry.occurredAt)}
                    </TableCell>

                    {/* Actor */}
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1">
                        <span
                          className="font-mono text-[12px] ct-text-body"
                          title={entry.actorWallet}
                        >
                          {truncateWallet(entry.actorWallet)}
                        </span>
                        {entry.ip ? (
                          <span className="text-[12px] ct-text-muted">{entry.ip}</span>
                        ) : null}
                      </div>
                    </TableCell>

                    {/* Action */}
                    <TableCell className="align-top">
                      <AuditActionLabel action={entry.action} />
                    </TableCell>

                    {/* Entity */}
                    <TableCell className="hidden align-top lg:table-cell">
                      <div className="flex flex-col gap-1">
                        <span className="text-[12px] font-medium ct-text-strong">
                          {entry.entityType}
                        </span>
                        <span className="font-mono text-[12px] ct-text-muted">
                          {entry.entityId}
                        </span>
                      </div>
                    </TableCell>

                    {/* Details — before/after diff in a native <details> */}
                    <TableCell className="align-top whitespace-normal">
                      <details className="group flex flex-col gap-1.5">
                        <summary className="cursor-pointer select-none list-none text-[12px] ct-text-muted hover:ct-text-body">
                          <span className="group-open:hidden">Show diff</span>
                          <span className="hidden group-open:inline">Hide diff</span>
                        </summary>
                        <DiffBlock label="Before" value={entry.before} muted />
                        <DiffBlock label="After" value={entry.after} />
                        {entry.userAgent ? (
                          <p className="truncate text-[12px] ct-text-muted">
                            UA: {entry.userAgent}
                          </p>
                        ) : null}
                      </details>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </BentoPanel>
        )}

        <div className="flex flex-col gap-1 border-t p-4 ct-bento-divider">
          <p className="ct-bento-label">Audit retention</p>
          <p className="text-[12px] ct-text-muted">
            Showing up to 200 entries per query. Entries written by{" "}
            <code className="font-mono ct-text-body">recordAdminAudit()</code>{" "}
            are append-only — export directly from the database for formal
            compliance reporting.
          </p>
        </div>
      </section>
    </BentoPageShell>
  );
}
