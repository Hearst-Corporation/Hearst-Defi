import { Card } from "@/components/ui/card";
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
 * Cockpit Admin — Audit Trail (rolling 20 entries).
 *
 * Table rendering of AdminAudit rows: time, actor wallet (truncated),
 * action, entity type + id.
 * Graceful empty state.
 */
export function AuditTrailRolling({ entries }: AuditTrailRollingProps) {
  return (
    <Card aria-label="Audit trail">
      <h2 className="h2 mb-4">Audit Trail</h2>

      {entries.length === 0 ? (
        <div className="py-6 ct-empty-state">
          <p className="body-sm ct-text-muted text-center">
            No audit events recorded yet.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-[var(--ct-card-p,1.5rem)]">
          <table className="w-full text-sm min-w-[640px]" aria-label="Admin audit log">
            <thead>
              <tr className="border-b border-[var(--ct-border)]">
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
    </Card>
  );
}

function AuditRow({ entry }: { entry: AuditTrailEntry }) {
  const wallet = truncateWallet(entry.actorWallet);
  const entityId = entry.entityId.length > 12
    ? `${entry.entityId.slice(0, 12)}…`
    : entry.entityId;

  return (
    <tr className="border-b border-[var(--ct-border-soft)] hover:bg-[var(--ct-surface-0)] transition-colors">
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Truncate a wallet address to 0x…abcd format (8 chars visible + last 4).
 * Falls back to first 10 chars for non-hex strings.
 */
function truncateWallet(addr: string): string {
  if (addr.startsWith("0x") && addr.length >= 10) {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }
  return addr.length > 12 ? `${addr.slice(0, 10)}…` : addr;
}
