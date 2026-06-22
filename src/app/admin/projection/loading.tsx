import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectionLoading() {
  return (
    <div className="animate-in fade-in duration-(--ct-dur-slower)">
      <div className="admin-doc-stack--actions">
        <Skeleton className="h-3 w-32" variant="text" />
        <div className="admin-doc-inline-row">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      <div className="admin-doc-stack">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
