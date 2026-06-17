
/**
 * Shared pagination types and helpers.
 *
 * Offset-based pagination (page / pageSize) for simplicity.
 * Cursor-based is available via Prisma's `cursor` + `skip: 1` for very large
 * tables where offset performance degrades.
 */

export const MAX_PAGE_SIZE = 100;


export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}


/** Clamp a raw page size to the allowed [1, MAX_PAGE_SIZE] range. */
export function clampPageSize(n: number): number {
  return Math.min(Math.max(n, 1), MAX_PAGE_SIZE);
}

/** Convert 1-based page to Prisma `skip` (0-based offset). */
export function toPrismaSkip(page: number, pageSize: number): number {
  return (Math.max(page, 1) - 1) * pageSize;
}

/** Build a paginated result from raw data + total count. */
export function toPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  return {
    data,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}
