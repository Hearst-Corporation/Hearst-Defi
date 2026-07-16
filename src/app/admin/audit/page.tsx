// Admin · Audit log read surface.
// Server Component — gated by admin layout (session.role).
// Filterable via plain GET <form>; no client JS required.
//
// Mounted on the canonical admin shell (AdminPageShell + AdminSectionCard) so
// the page surface, header grammar, and welded section cards match /customers.
// Tables use the shared Catalyst chrome (TABLE_HEAD / TABLE_WRAP / ROW).

import {
  AdminPageShell,
  AdminSectionCard,
  TABLE_HEAD,
  TABLE_WRAP,
  ROW,
} from "@/components/admin/admin-page-shell";
import { Badge } from "@/components/catalyst/badge";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { Input } from "@/components/catalyst/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { BentoLabel } from "@/components/catalyst/bento";
import { EmptySurface } from "@/components/catalyst/empty-surface";
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
    <Badge color={alert ? "rose" : "zinc"} className="mono">
      {action}
    </Badge>
  );
}

function DiffBlock({
  label,
  value,
  muted,
}: {
  label: string;
  value: unknown;
  muted?: boolean;
}) {
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
    <AdminPageShell
      titleLead="Audit"
      titleAccent="Log"
      contextLabel="Compliance"
    >
      {/* Filter bar — plain GET form, zero client JS. Catalyst Input + Button. */}
      <AdminSectionCard
        title="Filter audit log"
        subtitle="Narrow the log by entity, actor, or action — server-rendered GET, no client JS."
        ariaLabel="Filters"
      >
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
                className="mono"
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

            <CockpitButton type="submit" variant="outline" shape="rect" size="lg">
              Filter
            </CockpitButton>

            {hasFilters && (
              <CockpitButton href="/admin/audit" variant="quiet" shape="rect" size="lg">
                Clear
              </CockpitButton>
            )}
          </fieldset>
        </form>
      </AdminSectionCard>

      {/* Results — welded card: KPI strip → header → Catalyst table (edge-to-edge). */}
      <AdminSectionCard
        kpis={kpiStrip}
        kpiTitle="Audit activity"
        kpiSubtitle={`${entries.length} ${entries.length === 1 ? "event" : "events"} in view`}
        title={hasFilters ? "Filtered results" : "Recent events"}
        subtitle={
          hasFilters
            ? "Entries matching the current filter"
            : "Latest admin activity (up to 200 per query)"
        }
        headerTrailing={
          <Badge color="zinc" className="uppercase tabular-nums">
            {entries.length} total
          </Badge>
        }
        ariaLabel="Audit entries"
      >
        {entries.length === 0 ? (
          <EmptySurface
            variant="widget"
            message={
              hasFilters
                ? "No admin activity matches the current filter."
                : "No admin activity recorded yet."
            }
            detail={
              hasFilters
                ? "Adjust the criteria above or clear all filters to see the full log."
                : "Admin actions are written append-only by recordAdminAudit()."
            }
            className="min-h-32"
          />
        ) : (
          <Table dense className={TABLE_WRAP}>
            <TableHead>
              <TableRow>
                <TableHeader className={`${TABLE_HEAD} pl-5`}>When</TableHeader>
                <TableHeader className={TABLE_HEAD}>Actor</TableHeader>
                <TableHeader className={TABLE_HEAD}>Action</TableHeader>
                <TableHeader
                  className={`${TABLE_HEAD} hidden lg:table-cell`}
                >
                  Entity
                </TableHeader>
                <TableHeader className={`${TABLE_HEAD} pr-5`}>
                  Details
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id} className={ROW}>
                  {/* When */}
                  <TableCell className="ct-metric-caption pl-5 align-top mono">
                    {formatAdminAuditTimestamp(entry.occurredAt)}
                  </TableCell>

                  {/* Actor */}
                  <TableCell className="align-top">
                    <div className="flex flex-col gap-1">
                      <span
                        className="ct-metric-caption mono text-[var(--ct-text-body)]"
                        title={entry.actorWallet}
                      >
                        {truncateWallet(entry.actorWallet)}
                      </span>
                      {entry.ip ? (
                        <span className="ct-metric-caption">{entry.ip}</span>
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
                      <span className="ct-metric-value">
                        {entry.entityType}
                      </span>
                      <span className="ct-metric-caption mono">
                        {entry.entityId}
                      </span>
                    </div>
                  </TableCell>

                  {/* Details — before/after diff in a native <details> */}
                  <TableCell className="pr-5 align-top whitespace-normal">
                    <details className="group flex flex-col gap-1.5">
                      <summary className="ct-metric-caption cursor-pointer select-none list-none hover:text-[var(--ct-text-body)]">
                        <span className="group-open:hidden">Show diff</span>
                        <span className="hidden group-open:inline">
                          Hide diff
                        </span>
                      </summary>
                      <DiffBlock label="Before" value={entry.before} muted />
                      <DiffBlock label="After" value={entry.after} />
                      {entry.userAgent ? (
                        <p
                          className="ct-metric-caption truncate"
                          title={entry.userAgent}
                        >
                          UA: {entry.userAgent}
                        </p>
                      ) : null}
                    </details>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="flex flex-col gap-1 border-t border-[var(--ct-border-soft)] p-5">
          <p className="ct-bento-label">Audit retention</p>
          <p className="ct-metric-caption">
            Showing up to 200 entries per query. Entries written by{" "}
            <code className="mono text-[var(--ct-text-body)]">
              recordAdminAudit()
            </code>{" "}
            are append-only — export directly from the database for formal
            compliance reporting.
          </p>
        </div>
      </AdminSectionCard>
    </AdminPageShell>
  );
}
