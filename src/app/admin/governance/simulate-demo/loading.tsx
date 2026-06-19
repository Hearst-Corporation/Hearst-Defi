import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function GovernanceSimulateDemoLoading() {
  return (
    <div className="admin-doc-shell admin-doc-shell--narrow animate-in fade-in duration-(--ct-dur-slower)">
      <header className="admin-page-header">
        <Skeleton className="h-9 w-72" />
      </header>
      <SkeletonCard />
    </div>
  );
}
