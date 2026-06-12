import { SkeletonCard, Skeleton } from "@/components/ui/skeleton";

export default function InvestorMemoLoading() {
  return (
    <div className="admin-doc-shell animate-in fade-in duration-[var(--ct-dur-fast)]">
      <div className="admin-doc-stack--tight">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <SkeletonCard />
    </div>
  );
}
