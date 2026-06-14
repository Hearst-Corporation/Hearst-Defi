import "./profile.css";

import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div
      className="prof-shell product-doc-shell animate-in fade-in duration-[var(--ct-dur-slower)]"
      aria-busy="true"
      aria-label="Loading profile"
    >
      <header className="product-page-header">
        <div className="product-page-header__row">
          <div className="product-page-header__main">
            <div className="shrink-0">
              <Skeleton className="h-14 w-14" variant="circle" />
            </div>
            <div className="product-page-header__title-stack">
              <Skeleton className="h-3 w-28" variant="text" />
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-4 w-56" variant="text" />
            </div>
          </div>
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
      </header>

      <div className="prof-grid">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
