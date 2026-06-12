import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import { truncateWallet } from "@/lib/wallet-display";
import { formatAdminRollingTimestamp } from "@/lib/vaults/product-display";
import type { AuditTrailEntry } from "@/lib/data/cockpit";

interface AuditTrailRollingProps {
  entries: AuditTrailEntry[];
}

/**
 * Cockpit Admin — Recent admin activity (rolling 20 AdminAudit rows).
 *
 * Table rendering of AdminAudit rows: time, actor wallet (truncated),
 * action, entity type + id.
 * Graceful empty state.
 */
export function AuditTrailRolling({ entries }: AuditTrailRollingProps) {
  if (entries.length === 0) {
    return (
      <EmptySurface
        variant="widget"
        message="No admin activity recorded yet."
        ariaLabel="Recent admin activity"
      />
    );
  }

  return (
    <Card aria-label="Recent admin activity">
      <DashboardPanelHeader title="Recent admin activity" tone="quiet" />
      <div className="dashboard-panel-table-scroll ct-table-surface border-0 bg-transparent">
        <table className="w-full body-sm min-w-160" aria-label="Recent admin activity">
          <thead>
            <tr className="border-b border-[var(--ct-border-soft)]">
              <th className="text-left ct-table-header stat-label w-36">
                Time
              </th>
              <th className="text-left ct-table-header stat-label w-32">
                Actor
              </th>
              <th className="text-left ct-table-header stat-label">
                Action
              </th>
              <th className="text-left ct-table-header stat-label w-28">
                Entity
              </th>
              <th className="text-left ct-table-header stat-label w-32">
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
    </Card>
  );
}

function AuditRow({ entry }: { entry: AuditTrailEntry }) {
  const wallet = truncateWallet(entry.actorWallet);
  const entityId = entry.entityId.length > 12
    ? `${entry.entityId.slice(0, 12)}…`
    : entry.entityId;

  return (
    <tr className="border-b border-[var(--ct-border-soft)] transition-colors">
      <td className="ct-table-cell tabular body-xs ct-text-muted whitespace-nowrap">
        {formatAdminRollingTimestamp(new Date(entry.occurredAt))}
      </td>
      <td className="ct-table-cell ct-text-muted mono body-xs">
        {wallet}
      </td>
      <td className="ct-table-cell ct-text-body font-medium">
        {entry.action}
      </td>
      <td className="ct-table-cell ct-text-muted">
        {entry.entityType}
      </td>
      <td className="ct-table-cell ct-text-muted mono body-xs">
        {entityId}
      </td>
    </tr>
  );
}
