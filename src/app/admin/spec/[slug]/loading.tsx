export default function Loading() {
  return (
    <div className="admin-doc-shell animate-in fade-in duration-(--ct-dur-slower)">
      <div className="admin-doc-spec-layout">
        <aside className="w-56 shrink-0 admin-doc-stack admin-doc-stack--tight admin-doc-spec-aside">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-full animate-pulse rounded ct-surface-1"
            />
          ))}
        </aside>
        <article className="admin-doc-article">
          <div className="admin-doc-prose-shell admin-doc-stack admin-doc-stack--actions">
            <div className="h-3 w-24 animate-pulse rounded ct-surface-1" />
            <div className="h-12 w-2/3 animate-pulse rounded ct-surface-1" />
          </div>
          <div className="admin-doc-prose-shell admin-doc-stack admin-doc-stack--actions">
            <div className="h-4 w-full animate-pulse rounded ct-surface-1" />
            <div className="h-4 w-11/12 animate-pulse rounded ct-surface-1" />
            <div className="h-4 w-4/5 animate-pulse rounded ct-surface-1" />
            <div className="h-4 w-full animate-pulse rounded ct-surface-1" />
            <div className="h-4 w-3/4 animate-pulse rounded ct-surface-1" />
          </div>
        </article>
      </div>
    </div>
  );
}
