import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/** Loading placeholder aligned with `OnboardingChamber` crown / body / sole. */
export function OnboardingChamberLoading() {
  return (
    <article
      className="onboarding-chamber ct-glass-panel animate-in fade-in duration-(--ct-dur-slower)"
      aria-busy="true"
      aria-label="Loading onboarding step"
    >
      <div className="onboarding-chamber__crown">
        <Skeleton className="onb-skel-title w-full max-w-[var(--ct-prose-sm)]" />
        <div className="product-doc-stack--relaxed">
          <Skeleton className="onb-skel-eyebrow" variant="text" />
          <Skeleton className="onb-skel-heading" />
          <Skeleton className="onb-skel-line w-full max-w-[var(--ct-invest-flow-narrow)]" variant="text" />
          <Skeleton className="onb-skel-line w-full max-w-[var(--ct-invest-flow-narrow)]" variant="text" />
        </div>
      </div>

      <div className="onboarding-chamber__body">
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <div className="onboarding-chamber__sole">
        <Skeleton className="onb-skel-cta w-full" />
      </div>
    </article>
  );
}
