import "./profile.css";

import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div
      className="prof-shell animate-in fade-in duration-(--ct-dur-slower)"
      aria-busy="true"
      aria-label="Loading profile"
    >
      <header className="product-page-header">
        <div className="product-page-header__row">
          <div className="product-page-header__main">
            <div className="shrink-0">
              <Skeleton className="prof-skel-avatar" variant="circle" />
            </div>
            <div className="product-page-header__title-stack">
              <Skeleton className="prof-skel-eyebrow" variant="text" />
              <Skeleton className="prof-skel-title" />
              <Skeleton className="prof-skel-sub" variant="text" />
            </div>
          </div>
          <Skeleton className="prof-skel-badge" />
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
