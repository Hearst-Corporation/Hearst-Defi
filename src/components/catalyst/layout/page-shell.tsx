import type React from 'react'

import { cn } from '@/lib/cn'

/**
 * PageShell — canonical bento page wrapper.
 *
 * Collapses the duplicated inline page wrapper that admin/product surfaces hand-roll:
 *
 *   <div className="dark flex flex-col rounded-2xl border border-white/10 bg-surface-page mb-8">
 *     <div className="p-5 lg:p-6 flex flex-col gap-y-5">{children}</div>
 *   </div>
 *
 * Server Component (no client interactivity). Lives under the canonical Catalyst
 * layer — NOT under the legacy `src/components/ui` (that layer is frozen and not
 * promoted; see src/components/ui/README.md and src/components/catalyst/README.md).
 *
 * `className` is appended to the OUTER shell so callers can keep page-scoped
 * modifiers (e.g. `[--gutter:...]`, a page-fit class) without re-declaring the
 * surface grammar. Any extra div attributes (e.g. `aria-busy`, `aria-label` on a
 * loading skeleton) spread onto the OUTER shell.
 */
export function PageShell({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        'dark flex flex-col rounded-2xl border border-white/10 bg-surface-page mb-8',
        className,
      )}
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">{children}</div>
    </div>
  )
}
