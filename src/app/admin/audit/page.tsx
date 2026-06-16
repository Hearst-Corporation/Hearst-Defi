// Admin · Audit log read surface.
// Server Component — inherits the /admin layout's requireAdmin() gate.
// Filterable via plain GET <form>; no client JS required.

import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { getAdminAuditLog } from "@/lib/admin/audit";
import { cn } from "@/lib/cn";
import { truncateWallet } from "@/lib/wallet-display";
import { formatAdminAuditTimestamp } from "@/lib/vaults/product-display";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Activity Log — Hearst Connect",
};

/**
 * Derive a Badge variant from an action string so compliance reviewers
 * can visually distinguish write vs. read-adjacent vs. destructive events.
 */
function actionVariant(
  action: string,
): "default" | "success" | "warning" | "danger" {
  if (
    action.includes("pause") ||
    action.includes("reject") ||
    action.includes("delete")
  )
    return "danger";
  if (action.includes("approve") || action.includes("attest"))
    return "success";
  if (action.includes("submit") || action.includes("update"))
    return "warning";
  return "default";
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

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Admin activity log"
        description="Immutable record of admin actions — approvals, pauses, distributions, and state transitions."
      />

      {/* Filter bar — plain GET form, zero client JS */}
      <Card>
        <form method="get" className="admin-doc-inline-row admin-doc-inline-row--end admin-doc-inline-row--actions">
          <label className="admin-doc-field">
            <span className="stat-label ct-text-muted">Entity type</span>
            <input
              name="entityType"
              defaultValue={entityType ?? ""}
              placeholder="e.g. VaultDeployment"
              className={cn(
                "h-8 rounded-md border px-3 body-sm ct-bc-soft ct-surface-0 ct-text-body",
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
                "h-8 rounded-md border px-3 body-sm mono ct-bc-soft ct-surface-0 ct-text-body",
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
                "h-8 rounded-md border px-3 body-sm ct-bc-soft ct-surface-0 ct-text-body",
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
                    <th className="w-[18%] ct-table-header stat-label">
                      When
                    </th>
                    <th className="w-[18%] ct-table-header stat-label">
                      Actor
                    </th>
                    <th className="w-[18%] ct-table-header stat-label">
                      Action
                    </th>
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
                      <td className="ct-table-cell mono body-xs ct-text-muted">
                        {formatAdminAuditTimestamp(entry.occurredAt)}
                      </td>

                      {/* Actor */}
                      <td className="ct-table-cell">
                        <span
                          className="mono body-xs ct-text-body"
                          title={entry.actorWallet}
                        >
                          {truncateWallet(entry.actorWallet)}
                        </span>
                        {entry.ip ? (
                          <span className="block body-xs">
                            {entry.ip}
                          </span>
                        ) : null}
                      </td>

                      {/* Action */}
                      <td className="ct-table-cell">
                        <Badge variant={actionVariant(entry.action)}>
                          {entry.action}
                        </Badge>
                      </td>

                      {/* Entity */}
                      <td className="hidden ct-table-cell lg:table-cell">
                        <span className="block body-xs ct-text-strong">
                          {entry.entityType}
                        </span>
                        <span className="mono block body-xs">
                          {entry.entityId}
                        </span>
                      </td>

                      {/* Details — before/after diff in a native <details> */}
                      <td className="ct-table-cell">
                        <details className="group">
                          <summary className="cursor-pointer list-none body-xs ct-text-muted hover:ct-text-body select-none">
                            <span className="group-open:hidden">Show diff</span>
                            <span className="hidden group-open:inline">
                              Hide diff
                            </span>
                          </summary>
                          <div className="mt-2 admin-doc-stack admin-doc-stack--tight">
                            <div>
                              <p className="stat-label mb-0.5 ct-text-muted">
                                Before
                              </p>
                              <pre
                                className={cn(
                                  "mono body-xs max-h-40 overflow-auto rounded border p-2 leading-relaxed whitespace-pre-wrap break-all",
                                  "ct-bc-soft ct-surface-0 ct-text-muted",
                                )}
                              >
                                {entry.before === null
                                  ? "null"
                                  : JSON.stringify(entry.before, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <p className="stat-label mb-0.5 ct-text-muted">
                                After
                              </p>
                              <pre
                                className={cn(
                                  "mono body-xs max-h-40 overflow-auto rounded border p-2 leading-relaxed whitespace-pre-wrap break-all",
                                  "ct-bc-soft ct-surface-0 ct-text-body",
                                )}
                              >
                                {entry.after === null
                                  ? "null"
                                  : JSON.stringify(entry.after, null, 2)}
                              </pre>
                            </div>
                            {entry.userAgent ? (
                              <p className="body-xs truncate">
                                UA: {entry.userAgent}
                              </p>
                            ) : null}
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-doc-stack admin-doc-stack--tight border-t border-(--ct-border-soft) px-5 py-4">
              <p className="stat-label m-0">Audit retention</p>
              <p className="body-xs ct-text-muted m-0">
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
