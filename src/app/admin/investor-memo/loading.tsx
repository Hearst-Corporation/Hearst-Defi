import { SkeletonCard, Skeleton } from "@/components/ui/skeleton";

export default function InvestorMemoLoading() {
  return (
    <div className="space-y-8 animate-in fade-in duration-[var(--ct-dur-fast)]">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <SkeletonCard />
    </div>
  );
}
