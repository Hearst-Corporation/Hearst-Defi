import type { ReactNode } from "react";

/**
 * Uniform admin page title. Every admin page renders its title through this so
 * the H1 always lands on the same line, at the same position, with the same
 * spacing — section/breadcrumb context comes from the rail + the AdminSubNav
 * tabs, so no per-page eyebrow. Optional `actions` sit on the same row, right.
 */
export function AdminPageHeader({
  title,
  actions,
}: {
  title: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h1 className="h1 shrink-0">{title}</h1>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
