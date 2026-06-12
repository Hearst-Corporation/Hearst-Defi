import { EmptySurface } from "@/components/ui/empty-surface";
import { DashboardPanelHeader, SystemPanel } from "@/components/ui/system-panel";
import { truncateWallet } from "@/lib/wallet-display";
import type { AuditTrailEntry } from "@/lib/data/cockpit";

interface AuditTrailRollingProps {
  entries: AuditTrailEntry[];
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * Cockpit Admin — Recent admin activity (rolling 20 AdminAudit rows).
 *
 * Table rendering of AdminAudit rows: time, actor wallet (truncated),
 * action, entity type + id.
 * Graceful empty state.
 */
export function AuditTrailRolling({ entries }: AuditTrailRollingProps) {
  return (
    <SystemPanel aria-label="Recent admin activity">
      <DashboardPanelHeader eyebrow="Compliance" title="Recent admin activity" tone="quiet" />

      {entries.length === 0 ? (
        <EmptySurface
          variant="inline"
          message="No admin activity recorded yet."
          className="py-6"
        />
      ) : (
        <div className="dashboard-system-panel__table-scroll ct-table-surface border-0 bg-transparent">
          <table className="w-full text-sm min-w-160" aria-label="Recent admin activity">
            <thead>
              <tr className="border-b border-(--ct-border-soft)">
                <th className="text-left ct-table-header font-medium ct-text-faint w-36">
                  Time
                </th>
                <th className="text-left ct-table-header font-medium ct-text-faint w-32">
                  Actor
                </th>
                <th className="text-left ct-table-header font-medium ct-text-faint">
                  Action
                </th>
                <th className="text-left ct-table-header font-medium ct-text-faint w-28">
                  Entity
                </th>
                <th className="text-left ct-table-header font-medium ct-text-faint w-32">
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
      )}
    </SystemPanel>
  );
}

function AuditRow({ entry }: { entry: AuditTrailEntry }) {
  const wallet = truncateWallet(entry.actorWallet);
  const entityId = entry.entityId.length > 12
    ? `${entry.entityId.slice(0, 12)}…`
    : entry.entityId;

  return (
    <tr className="border-b border-(--ct-border-soft) transition-colors">
      <td className="ct-table-cell tabular ct-text-faint whitespace-nowrap">
        {dateFmt.format(new Date(entry.occurredAt))}
      </td>
      <td className="ct-table-cell ct-text-muted mono text-xs">
        {wallet}
      </td>
      <td className="ct-table-cell ct-text-body font-medium">
        {entry.action}
      </td>
      <td className="ct-table-cell ct-text-muted">
        {entry.entityType}
      </td>
      <td className="ct-table-cell ct-text-faint mono text-xs">
        {entityId}
      </td>
    </tr>
  );
}
