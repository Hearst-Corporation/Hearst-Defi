import type { ReactNode } from "react";
import Link from "next/link";

import { BentoPanel } from "@/components/catalyst/bento";
import { cn } from "@/lib/cn";

interface AdminTableProps<T> {
  data: ReadonlyArray<T>;
  headers: ReactNode[];
  renderRow: (item: T) => ReactNode;
  className?: string;
  colWidths?: string[];
}

/**
 * Admin data table — Portfolio "Active Positions" canon (bento).
 * Black panel + hairline border, micro uppercase thead labels, rows with a
 * hairline divider and a faint hover wash. The cells themselves are supplied by
 * each consumer's `renderRow` (they pass their own `<td>`), so only the chrome
 * (panel, thead, row hover) is styled here.
 */
export function AdminTable<T>({
  data,
  headers,
  renderRow,
  className,
  colWidths,
}: AdminTableProps<T>) {
  return (
    <BentoPanel className={className}>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--ct-border-soft)]">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={cn(
                    "ct-bento-label px-5 py-3 whitespace-nowrap",
                    colWidths?.[i],
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => (
              <tr
                key={i}
                className="border-b border-[var(--ct-border-soft)] transition-colors last:border-0 hover:bg-white/[0.02]"
              >
                {renderRow(item)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BentoPanel>
  );
}

interface AdminPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  basePath: string;
}

export function AdminPagination({
  page,
  pageSize,
  total,
  hasMore,
  basePath,
}: AdminPaginationProps) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ct-border-soft)] py-4">
      <p className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-muted)] tabular-nums">
        Showing {start}-{end} of {total}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 && (
          <Link
            href={`${basePath}?page=${page - 1}&pageSize=${pageSize}`}
            className="rounded-lg border border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_10%,transparent)]"
          >
            Previous
          </Link>
        )}
        {hasMore && (
          <Link
            href={`${basePath}?page=${page + 1}&pageSize=${pageSize}`}
            className="rounded-lg border border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_10%,transparent)]"
          >
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
