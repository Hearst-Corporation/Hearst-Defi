import { EmptySurface } from "@/components/ui/empty-surface";
import { truncateWallet } from "@/lib/wallet-display";
import { formatAdminRollingTimestamp } from "@/lib/vaults/product-display";
import type { AuditTrailEntry } from "@/lib/data/cockpit";

interface AuditTrailRollingProps {
  entries: AuditTrailEntry[];
}

/**
 * Cockpit Admin — Recent admin activity (rolling 20 AdminAudit rows).
 * Content-only: no panel wrapper/header — provided by parent cell.
 *
 * Table rendering of AdminAudit rows: time, actor wallet (truncated),
 * action, entity type + id.
 * Graceful empty state.
 */
export function AuditTrailRolling({ entries }: AuditTrailRollingProps) {
  if (entries.length === 0) {
    // Empty branch renders only the honest message — no header-only table
    // skeleton, which would otherwise read as a broken/loading table.
    return (
      <EmptySurface
        variant="inline"
        message="No admin activity recorded yet."
        ariaLabel="Audit trail"
        className="flex-1 flex items-center justify-center py-(--ct-space-8)"
      />
    );
  }

  return (
    <div aria-label="Audit trail">
      <div className="overflow-hidden">
        <table className="w-full table-fixed body-sm" aria-label="Audit trail">
          <thead>
            <tr className="cockpit-table-rule">
              <th className="cockpit-col-time text-left ct-table-header stat-label">
                Time
              </th>
              <th className="cockpit-col-actor text-left ct-table-header stat-label">
                Actor
              </th>
              <th className="cockpit-col-action text-left ct-table-header stat-label">
                Action
              </th>
              <th className="hidden cockpit-col-entity text-left ct-table-header stat-label md:table-cell">
                Entity
              </th>
              <th className="hidden cockpit-col-entity-id text-left ct-table-header stat-label lg:table-cell">
                Entity ID
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditTrailEntry }) {
  const wallet = truncateWallet(entry.actorWallet);
  const entityId = entry.entityId.length > 12
    ? `${entry.entityId.slice(0, 12)}…`
    : entry.entityId;

  return (
    <tr className="cockpit-table-rule cockpit-hover-row cursor-default">
      <td className="ct-table-cell tabular body-xs ct-text-muted text-left">
        {formatAdminRollingTimestamp(new Date(entry.occurredAt))}
      </td>
      <td className="ct-table-cell ct-text-muted mono body-xs text-left">
        {wallet}
      </td>
      <td className="ct-table-cell ct-text-body truncate text-left">
        {entry.action}
      </td>
      <td className="hidden ct-table-cell ct-text-muted text-left md:table-cell">
        {entry.entityType}
      </td>
      <td className="hidden ct-table-cell ct-text-muted mono body-xs text-left lg:table-cell">
        {entityId}
      </td>
    </tr>
  );
}
