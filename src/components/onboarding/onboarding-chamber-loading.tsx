import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/** Loading placeholder aligned with `OnboardingChamber` crown / body / sole. */
export function OnboardingChamberLoading() {
  return (
    <article
      className="onboarding-chamber ct-glass-panel animate-in fade-in duration-[var(--ct-dur-slower)]"
      aria-busy="true"
      aria-label="Loading onboarding step"
    >
      <div className="onboarding-chamber__crown">
        <Skeleton className="h-8 w-full max-w-sm" />
        <div className="product-doc-stack--tight">
          <Skeleton className="h-3 w-40" variant="text" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-full max-w-xl" variant="text" />
          <Skeleton className="h-4 w-full max-w-lg" variant="text" />
        </div>
      </div>

      <div className="onboarding-chamber__body">
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <div className="onboarding-chamber__sole">
        <Skeleton className="h-11 w-full" />
      </div>
    </article>
  );
}
