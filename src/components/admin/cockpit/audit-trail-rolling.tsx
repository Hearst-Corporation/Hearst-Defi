import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
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
    <Table aria-label="Audit trail" className="table-fixed">
      <TableHead>
        <TableRow className="border-b border-[var(--ct-border-soft)]">
          <TableHeader className="w-[28%] truncate text-left px-3 py-2 ct-bento-label md:w-[22%] lg:w-[16%]">
            Time
          </TableHeader>
          <TableHeader className="w-[34%] truncate text-left px-3 py-2 ct-bento-label md:w-[24%] lg:w-[18%]">
            Actor
          </TableHeader>
          <TableHeader className="w-[38%] truncate text-left px-3 py-2 ct-bento-label md:w-[26%] lg:w-[24%]">
            Action
          </TableHeader>
          <TableHeader className="hidden w-[28%] truncate text-left px-3 py-2 ct-bento-label md:table-cell lg:w-[24%]">
            Entity
          </TableHeader>
          <TableHeader className="hidden w-[18%] truncate text-left px-3 py-2 ct-bento-label lg:table-cell">
            Entity ID
          </TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {entries.map((entry) => (
          <AuditRow key={entry.id} entry={entry} />
        ))}
      </TableBody>
    </Table>
  );
}

function AuditRow({ entry }: { entry: AuditTrailEntry }) {
  const wallet = truncateWallet(entry.actorWallet);
  const entityId = entry.entityId.length > 10
    ? `${entry.entityId.slice(0, 10)}…`
    : entry.entityId;

  return (
    <TableRow className="group border-b border-[var(--ct-border-soft)] last:border-b-0 cursor-default transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)]">
      <TableCell className="truncate px-3 py-2 text-left text-[length:var(--ct-text-xs)] text-[var(--ct-text-body)] tabular-nums">
        {formatAdminRollingTimestamp(new Date(entry.occurredAt))}
      </TableCell>
      <TableCell className="truncate px-3 py-2 text-left text-[length:var(--ct-text-xs)] mono text-[var(--ct-text-faint)] group-hover:text-[var(--ct-text-muted)]">
        {wallet}
      </TableCell>
      <TableCell className="truncate px-3 py-2 text-left text-[length:var(--ct-text-xs)] text-[var(--ct-text-body)] uppercase">
        {entry.action}
      </TableCell>
      <TableCell className="hidden truncate px-3 py-2 text-left text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)] uppercase md:table-cell">
        {entry.entityType}
      </TableCell>
      <TableCell className="hidden truncate px-3 py-2 text-left text-[length:var(--ct-text-xs)] mono text-[var(--ct-text-faint)] lg:table-cell">
        {entityId}
      </TableCell>
    </TableRow>
  );
}
