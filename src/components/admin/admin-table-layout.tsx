import type { ReactNode } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

interface AdminTableProps<T> {
  data: ReadonlyArray<T>;
  headers: ReactNode[];
  renderRow: (item: T) => ReactNode;
  className?: string;
  colWidths?: string[];
}

export function AdminTable<T>({
  data,
  headers,
  renderRow,
  className,
  colWidths,
}: AdminTableProps<T>) {
  return (
    <Card className={cn("p-0 overflow-hidden", className)} hoverOverlay={false}>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left body-sm">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={cn(
                    "stat-label ct-table-header whitespace-nowrap",
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
                className="border-b border-(--ct-border-soft) last:border-0"
              >
                {renderRow(item)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
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
    <div className="admin-doc-stack admin-doc-stack--compact border-t border-(--ct-border-soft) py-(--ct-space-4)">
      <div className="admin-doc-row-spread">
        <p className="body-xs ct-text-muted">
          Showing {start}-{end} of {total}
        </p>
        <div className="admin-doc-inline-row">
          {page > 1 && (
            <Link
              href={`${basePath}?page=${page - 1}&pageSize=${pageSize}`}
              className="rounded-md border border-(--ct-border-soft) px-(--ct-space-3) py-(--ct-space-1_5) body-xs ct-text-muted hover:ct-text-strong transition-colors ease-(--ct-ease)"
            >
              Previous
            </Link>
          )}
          {hasMore && (
            <Link
              href={`${basePath}?page=${page + 1}&pageSize=${pageSize}`}
              className="rounded-md border border-(--ct-border-soft) px-(--ct-space-3) py-(--ct-space-1_5) body-xs ct-text-muted hover:ct-text-strong transition-colors ease-(--ct-ease)"
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
