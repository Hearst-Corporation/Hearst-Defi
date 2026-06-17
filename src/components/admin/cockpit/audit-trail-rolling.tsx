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
      <Card aria-label="Audit trail" hoverOverlay={false} className="dashboard-command-cell dashboard-command-cell--awaiting">
        <DashboardPanelHeader title="Audit trail" tone="quiet" />
        <div className="overflow-hidden">
          <table className="w-full table-fixed body-sm" aria-label="Audit trail">
            <thead>
              <tr className="border-b border-(--ct-border-soft)">
                <th className="w-[20%] text-left ct-table-header stat-label">Time</th>
                <th className="w-[18%] text-left ct-table-header stat-label">Actor</th>
                <th className="w-[24%] text-left ct-table-header stat-label">Action</th>
                <th className="hidden w-[18%] text-left ct-table-header stat-label md:table-cell">
                  Entity
                </th>
                <th className="hidden w-[20%] text-left ct-table-header stat-label lg:table-cell">
                  Entity ID
                </th>
              </tr>
            </thead>
          </table>
        </div>
        <EmptySurface
          variant="inline"
          message="No admin activity recorded yet."
          ariaLabel="Audit trail"
        />
      </Card>
    );
  }

  return (
    <Card aria-label="Audit trail" hoverOverlay={false}>
      <DashboardPanelHeader title="Audit trail" tone="quiet" />
      <div className="overflow-hidden">
        <table className="w-full table-fixed body-sm" aria-label="Audit trail">
          <thead>
            <tr className="border-b border-(--ct-border-soft)">
              <th className="w-[20%] text-left ct-table-header stat-label">
                Time
              </th>
              <th className="w-[18%] text-left ct-table-header stat-label">
                Actor
              </th>
              <th className="w-[24%] text-left ct-table-header stat-label">
                Action
              </th>
              <th className="hidden w-[18%] text-left ct-table-header stat-label md:table-cell">
                Entity
              </th>
              <th className="hidden w-[20%] text-left ct-table-header stat-label lg:table-cell">
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
    <tr className="border-b border-(--ct-border-soft)">
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
