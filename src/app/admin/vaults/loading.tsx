import { Skeleton } from "@/components/ui/skeleton";

export default function VaultsLoading() {
  return (
    <div className="admin-doc-shell animate-in fade-in duration-(--ct-dur-slower)">
      <div className="admin-page-header">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-64 mt-1" variant="text" />
      </div>

      <div className="admin-doc-inline-row">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-14" />
        ))}
      </div>

      <div className="admin-vaults-list">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="admin-vaults-list__row">
            <div className="admin-vaults-list__identity">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-36 mt-1" variant="text" />
              <Skeleton className="h-3 w-24 mt-0.5" variant="text" />
            </div>
            <div className="admin-vaults-list__status">
              <Skeleton className="h-3 w-12" variant="text" />
            </div>
            <div className="admin-vaults-list__metrics">
              <Skeleton className="h-1 w-full" />
              <Skeleton className="h-3 w-24 mt-1" variant="text" />
            </div>
            <div className="admin-vaults-list__apy">
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="admin-vaults-list__actions">
              <Skeleton className="h-8 w-12" />
              <Skeleton className="h-8 w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
