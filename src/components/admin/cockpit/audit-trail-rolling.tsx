import { EmptySurface } from "@/components/ui/empty-surface";
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
          <tr className="border-b border-white/5">
            <th className="text-left px-3 py-2 text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
              Time
            </th>
            <th className="text-left px-3 py-2 text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
              Actor
            </th>
            <th className="text-left px-3 py-2 text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
              Action
            </th>
            <th className="hidden text-left px-3 py-2 text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500 md:table-cell">
              Entity
            </th>
            <th className="hidden text-left px-3 py-2 text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500 lg:table-cell">
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
    <tr className="group border-b border-white/5 last:border-b-0 cursor-default transition-colors hover:bg-white/[0.02]">
      <td className="px-3 py-2 text-left text-[13px] text-zinc-300 tabular-nums">
        {formatAdminRollingTimestamp(new Date(entry.occurredAt))}
      </td>
      <td className="px-3 py-2 text-left text-[13px] font-mono text-zinc-500 group-hover:text-zinc-400">
        {wallet}
      </td>
      <td className="px-3 py-2 text-left text-[13px] text-zinc-300 uppercase truncate">
        {entry.action}
      </td>
      <td className="hidden px-3 py-2 text-left text-[13px] text-zinc-400 uppercase md:table-cell">
        {entry.entityType}
      </td>
      <td className="hidden px-3 py-2 text-left text-[13px] font-mono text-zinc-500 lg:table-cell">
        {entityId}
      </td>
    </tr>
  );
}
