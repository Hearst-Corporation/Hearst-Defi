export default function Loading() {
  return (
    <div className="ct-section flex gap-6">
      {/* Sidebar skeleton */}
      <aside className="w-56 shrink-0 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-4 w-full animate-pulse rounded ct-surface-1" />
        ))}
      </aside>
      {/* Article skeleton */}
      <article className="flex-1 space-y-3">
        <div className="h-8 w-2/3 animate-pulse rounded ct-surface-1" />
        <div className="h-4 w-full animate-pulse rounded ct-surface-1" />
        <div className="h-4 w-11/12 animate-pulse rounded ct-surface-1" />
        <div className="h-4 w-4/5 animate-pulse rounded ct-surface-1" />
        <div className="h-4 w-full animate-pulse rounded ct-surface-1" />
        <div className="h-4 w-3/4 animate-pulse rounded ct-surface-1" />
      </article>
    </div>
  );
}
