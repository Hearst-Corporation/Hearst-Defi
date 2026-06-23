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
    <div aria-label="Audit trail" className="dashboard-audit-trail">
      <div className="overflow-hidden border border-(--ct-border-ghost) rounded-(--ct-radius-sm)">
        <table className="w-full table-fixed body-sm" aria-label="Audit trail">
          <thead>
            <tr className="bg-ct-bg-soft/30">
              <th className="cockpit-col-time text-left px-2 py-1.5 cockpit-label-xs border-b border-(--ct-border-ghost)">
                Time
              </th>
              <th className="cockpit-col-actor text-left px-2 py-1.5 cockpit-label-xs border-b border-(--ct-border-ghost)">
                Actor
              </th>
              <th className="cockpit-col-action text-left px-2 py-1.5 cockpit-label-xs border-b border-(--ct-border-ghost)">
                Action
              </th>
              <th className="hidden cockpit-col-entity text-left px-2 py-1.5 cockpit-label-xs border-b border-(--ct-border-ghost) md:table-cell">
                Entity
              </th>
              <th className="hidden cockpit-col-entity-id text-left px-2 py-1.5 cockpit-label-xs border-b border-(--ct-border-ghost) lg:table-cell">
                Entity ID
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--ct-border-ghost)">
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
  const entityId = entry.entityId.length > 10
    ? `${entry.entityId.slice(0, 10)}…`
    : entry.entityId;

  return (
    <tr className="cockpit-hover-row cursor-default group transition-colors">
      <td className="px-2 py-1.5 cockpit-value-xs text-left">
        {formatAdminRollingTimestamp(new Date(entry.occurredAt))}
      </td>
      <td className="px-2 py-1.5 cockpit-value-xs text-left mono opacity-80 group-hover:opacity-100">
        {wallet}
      </td>
      <td className="px-2 py-1.5 cockpit-value-sm text-left uppercase truncate">
        {entry.action}
      </td>
      <td className="hidden px-2 py-1.5 cockpit-value-sm text-left md:table-cell uppercase opacity-70">
        {entry.entityType}
      </td>
      <td className="hidden px-2 py-1.5 cockpit-value-xs text-left lg:table-cell mono opacity-60">
        {entityId}
      </td>
    </tr>
  );
}
