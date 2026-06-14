import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="admin-doc-shell admin-doc-shell--compact animate-in fade-in duration-[var(--ct-dur-slower)]">
      <header className="admin-page-header">
        <div className="admin-page-header__row">
          <div className="admin-page-header__main">
            <Skeleton className="h-3 w-56" variant="text" />
            <Skeleton className="h-9 w-40" />
          </div>
          <div className="admin-page-header__actions admin-page-header__actions--stack">
            <div className="admin-doc-inline-row">
              <Skeleton className="h-8 w-20 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
          </div>
        </div>
      </header>

      <div className="admin-doc-stack admin-doc-stack--relaxed">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-52 w-full" />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>

        <SkeletonCard />
      </div>
    </div>
  );
}
