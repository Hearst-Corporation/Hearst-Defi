// Admin · Audit log read surface.
// Server Component — inherits the /admin layout's requireAdmin() gate.
// Filterable via plain GET <form>; no client JS required.

import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminKpiStripPanel } from "@/components/admin/dashboard/admin-kpi-strip-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { getAdminAuditLog } from "@/lib/admin/audit";
import { buildAuditKpiStrip } from "@/lib/admin/audit-kpi-strip";
import { cn } from "@/lib/cn";
import { truncateWallet } from "@/lib/wallet-display";
import { formatAdminAuditTimestamp } from "@/lib/vaults/product-display";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Audit Log — Hearst Connect",
};

/** Destructive / high-attention actions get a colored dot; routine events stay muted. */
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
    <span className="admin-doc-inline-row admin-doc-inline-row--dense min-w-0">
      <span
        aria-hidden
        className={cn(
          "ct-dot",
          alert
            ? "ct-status-dot-danger"
            : "bg-(--ct-border) opacity-[var(--ct-opacity-60)]",
        )}
      />
      <span
        className={cn(
          "mono body-xs truncate",
          alert ? "ct-status-danger font-medium" : "ct-text-muted",
        )}
      >
        {action}
      </span>
    </span>
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
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Audit Log"
        description="Immutable record of admin actions — approvals, pauses, distributions, and state transitions."
        eyebrow="Compliance"
      />

      {kpiStrip.length > 0 && <AdminKpiStripPanel kpis={kpiStrip} />}

      {/* Filter bar — plain GET form, zero client JS */}
      <section className="admin-doc-stack admin-doc-stack--actions" aria-label="Filters">
        <Card hoverOverlay={false}>
          <form
            method="get"
            className="admin-doc-inline-row admin-doc-inline-row--end admin-doc-inline-row--actions admin-doc-inline-row--relaxed"
          >
          <label className="admin-doc-field">
            <span className="stat-label ct-text-muted">Entity type</span>
            <input
              name="entityType"
              defaultValue={entityType ?? ""}
              placeholder="e.g. VaultDeployment"
              className={cn(
                "h-8 rounded-md border px-[var(--ct-space-3)] body-sm ct-bc-soft ct-surface-0 ct-text-body",
                "placeholder:ct-text-muted focus:outline-none focus:ct-bc-strong",
              )}
            />
          </label>

          <label className="admin-doc-field">
            <span className="stat-label ct-text-muted">Actor wallet</span>
            <input
              name="actor"
              defaultValue={actor ?? ""}
              placeholder="0x…"
              className={cn(
                "h-8 rounded-md border px-[var(--ct-space-3)] body-sm mono ct-bc-soft ct-surface-0 ct-text-body",
                "placeholder:ct-text-muted focus:outline-none focus:ct-bc-strong",
              )}
            />
          </label>

          <label className="admin-doc-field">
            <span className="stat-label ct-text-muted">Action</span>
            <input
              name="action"
              defaultValue={action ?? ""}
              placeholder="e.g. vault.approve"
              className={cn(
                "h-8 rounded-md border px-[var(--ct-space-3)] body-sm ct-bc-soft ct-surface-0 ct-text-body",
                "placeholder:ct-text-muted focus:outline-none focus:ct-bc-strong",
              )}
            />
          </label>

          <Button type="submit" variant="secondary" size="md">
            Filter
          </Button>

          {hasFilters && (
            <Button asChild variant="ghost" size="md">
              <Link href="/admin/audit">Clear</Link>
            </Button>
          )}
          </form>
        </Card>
      </section>

      {/* Results */}
      <section className="admin-doc-stack admin-doc-stack--actions" aria-label="Audit entries">
        <h2 className="h2">
          {hasFilters ? "Filtered results" : "Recent events"} ({entries.length})
        </h2>

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
                : undefined
            }
            className="min-h-32"
          />
        ) : (
          <Card className="p-0 overflow-hidden" hoverOverlay={false}>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left body-sm">
                <thead>
                  <tr>
                    <th className="w-[18%] ct-table-header stat-label">When</th>
                    <th className="w-[18%] ct-table-header stat-label">Actor</th>
                    <th className="w-[18%] ct-table-header stat-label">Action</th>
                    <th className="hidden w-[18%] ct-table-header stat-label lg:table-cell">
                      Entity
                    </th>
                    <th className="w-[46%] ct-table-header stat-label lg:w-[28%]">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-(--ct-border-soft) last:border-0 align-top"
                    >
                      {/* When */}
                      <td className="ct-table-cell mono body-xs ct-text-muted align-top">
                        {formatAdminAuditTimestamp(entry.occurredAt)}
                      </td>

                      {/* Actor */}
                      <td className="ct-table-cell align-top">
                        <div className="admin-doc-stack admin-doc-stack--micro">
                          <span
                            className="mono body-xs ct-text-body"
                            title={entry.actorWallet}
                          >
                            {truncateWallet(entry.actorWallet)}
                          </span>
                          {entry.ip ? (
                            <span className="body-xs ct-text-muted">{entry.ip}</span>
                          ) : null}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="ct-table-cell align-top">
                        <AuditActionLabel action={entry.action} />
                      </td>

                      {/* Entity */}
                      <td className="hidden ct-table-cell lg:table-cell align-top">
                        <div className="admin-doc-stack admin-doc-stack--micro">
                          <span className="body-xs ct-text-strong">
                            {entry.entityType}
                          </span>
                          <span className="mono body-xs ct-text-muted">
                            {entry.entityId}
                          </span>
                        </div>
                      </td>

                      {/* Details — before/after diff in a native <details> */}
                      <td className="ct-table-cell align-top">
                        <details className="group admin-doc-stack admin-doc-stack--tight">
                          <summary className="cursor-pointer list-none body-xs ct-text-muted hover:ct-text-body select-none">
                            <span className="group-open:hidden">Show diff</span>
                            <span className="hidden group-open:inline">
                              Hide diff
                            </span>
                          </summary>
                          <div className="admin-doc-stack admin-doc-stack--micro">
                            <p className="stat-label ct-text-muted">Before</p>
                            <pre
                              className={cn(
                                "mono body-xs max-h-40 overflow-auto rounded border p-[var(--ct-space-2)] leading-relaxed whitespace-pre-wrap break-all",
                                "ct-bc-soft ct-surface-0 ct-text-muted",
                              )}
                            >
                              {entry.before === null
                                ? "null"
                                : JSON.stringify(entry.before, null, 2)}
                            </pre>
                          </div>
                          <div className="admin-doc-stack admin-doc-stack--micro">
                            <p className="stat-label ct-text-muted">After</p>
                            <pre
                              className={cn(
                                "mono body-xs max-h-40 overflow-auto rounded border p-[var(--ct-space-2)] leading-relaxed whitespace-pre-wrap break-all",
                                "ct-bc-soft ct-surface-0 ct-text-body",
                              )}
                            >
                              {entry.after === null
                                ? "null"
                                : JSON.stringify(entry.after, null, 2)}
                            </pre>
                          </div>
                          {entry.userAgent ? (
                            <p className="body-xs truncate ct-text-muted">
                              UA: {entry.userAgent}
                            </p>
                          ) : null}
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-doc-stack admin-doc-stack--micro border-t border-(--ct-border-soft) p-[var(--ct-space-4)]">
              <p className="stat-label">Audit retention</p>
              <p className="body-xs ct-text-muted">
                Showing up to 200 entries per query. Entries written by{" "}
                <code className="mono ct-text-body">recordAdminAudit()</code>{" "}
                are append-only; export directly from the database for formal
                compliance reporting.
              </p>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
