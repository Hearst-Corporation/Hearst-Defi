/**
 * Compatibility wrapper — the canon now lives in `@/components/catalyst/skeleton`.
 *
 * This module re-exports the canonical Skeleton / SkeletonCard / AdminPageLoading
 * so existing `@/components/ui/skeleton` importers keep working. New code should
 * import from `@/components/catalyst/skeleton` directly.
 */

export { Skeleton, SkeletonCard, AdminPageLoading } from "@/components/catalyst/skeleton";
