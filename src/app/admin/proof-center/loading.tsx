import { SkeletonCard, Skeleton } from "@/components/ui/skeleton";

export default function ProofCenterLoading() {
  return (
    <div className="space-y-8 animate-in fade-in duration-[var(--ct-dur-slower)]">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-8 w-32 rounded-full" />
        </div>
        <Skeleton className="h-4 w-96" />
      </div>

      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
