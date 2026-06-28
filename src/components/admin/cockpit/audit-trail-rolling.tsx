import { EmptySurface } from "@/components/catalyst/empty-surface";
import { truncateWallet } from "@/lib/wallet-display";
import { formatAdminRollingTimestamp } from "@/lib/vaults/product-display";
import type { AuditTrailEntry } from "@/lib/data/cockpit";

interface AuditTrailRollingProps {
  entries: AuditTrailEntry[];
}

/**
 * Cockpit Admin — Recent admin activity (rolling 20 AdminAudit rows).
 * Content-only: no panel wrapper/header — provided by parent BentoPanel cell.
 *
 * Table rendering of AdminAudit rows: time, actor wallet (truncated),
 * action, entity type + id. Bento Tailwind (Portfolio Positions canon).
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
        className="flex-1 flex items-center justify-center py-8"
      />
    );
  }

  return (
    <div aria-label="Audit trail" className="overflow-x-auto">
      <table className="w-full table-fixed" aria-label="Audit trail">
        <thead>
          <tr className="border-b border-[var(--ct-border-soft)]">
            <th className="text-left px-3 py-2 ct-bento-label">
              Time
            </th>
            <th className="text-left px-3 py-2 ct-bento-label">
              Actor
            </th>
            <th className="text-left px-3 py-2 ct-bento-label">
              Action
            </th>
            <th className="hidden text-left px-3 py-2 ct-bento-label md:table-cell">
              Entity
            </th>
            <th className="hidden text-left px-3 py-2 ct-bento-label lg:table-cell">
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
  );
}

function AuditRow({ entry }: { entry: AuditTrailEntry }) {
  const wallet = truncateWallet(entry.actorWallet);
  const entityId = entry.entityId.length > 10
    ? `${entry.entityId.slice(0, 10)}…`
    : entry.entityId;

  return (
    <tr className="group border-b border-[var(--ct-border-soft)] last:border-b-0 cursor-default transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)]">
      <td className="px-3 py-2 text-left text-[length:var(--ct-text-xs)] text-[var(--ct-text-body)] tabular-nums">
        {formatAdminRollingTimestamp(new Date(entry.occurredAt))}
      </td>
      <td className="px-3 py-2 text-left text-[length:var(--ct-text-xs)] font-mono text-[var(--ct-text-faint)] group-hover:text-[var(--ct-text-muted)]">
        {wallet}
      </td>
      <td className="px-3 py-2 text-left text-[length:var(--ct-text-xs)] text-[var(--ct-text-body)] uppercase truncate">
        {entry.action}
      </td>
      <td className="hidden px-3 py-2 text-left text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)] uppercase md:table-cell">
        {entry.entityType}
      </td>
      <td className="hidden px-3 py-2 text-left text-[length:var(--ct-text-xs)] font-mono text-[var(--ct-text-faint)] lg:table-cell">
        {entityId}
      </td>
    </tr>
  );
}
