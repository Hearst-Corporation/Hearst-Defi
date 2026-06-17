import { SkeletonCard, Skeleton } from "@/components/ui/skeleton";

export default function SpecLoading() {
  return (
    <div className="admin-doc-shell animate-in fade-in duration-(--ct-dur-slower)">
      <div className="admin-doc-spec-layout">
        <aside className="admin-doc-stack admin-doc-stack--tight md:self-start">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" variant="rect" />
          ))}
        </aside>

        <article className="min-w-0 flex flex-col gap-[var(--ct-space-8)]">
          <div className="admin-doc-prose-shell admin-doc-stack admin-doc-stack--actions">
            <Skeleton className="h-3 w-24" variant="text" />
            <Skeleton className="h-12 w-64" />
          </div>
          <div className="admin-doc-prose-shell">
            <SkeletonCard />
          </div>
          <div className="admin-doc-prose-shell">
            <SkeletonCard />
          </div>
        </article>
      </div>
    </div>
  );
}
