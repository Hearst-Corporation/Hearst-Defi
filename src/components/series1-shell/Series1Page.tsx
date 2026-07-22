import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

// DS doctrine §6: L1 = --ct-text-strong, L2 = --ct-text-strong (never green),
// supporting copy = --ct-text-muted. Tokens only — the zinc/dark: twin ramp
// this shell used to carry is gone (visual-alignment-plan step 1).

export function Series1PageTitle({
  title,
  meta,
  description,
  actions,
}: {
  title: string;
  meta?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-(--ct-text-strong)">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-(--ct-text-muted)">{description}</p>
        ) : null}
      </div>
      <div className="flex min-w-0 items-center gap-3">
        {meta ? <p className="text-xs text-(--ct-text-faint)">{meta}</p> : null}
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Series1Section({
  index,
  title,
  description,
  actions,
  children,
  className,
}: {
  index?: string;
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headed = Boolean(index || title || description || actions);
  return (
    <section
      className={cn(headed && "border-t border-(--ct-border-soft) pt-8", className)}
    >
      {headed ? (
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div>
            <div className="flex items-center gap-3">
              {index ? (
                <span className="flex size-7 items-center justify-center rounded-(--ct-radius-sm) bg-(--ct-status-neutral-soft) text-xs font-semibold text-(--ct-text-muted) tabular-nums">
                  {index}
                </span>
              ) : null}
              {title ? (
                <h2 className="text-base font-semibold text-(--ct-text-strong)">{title}</h2>
              ) : null}
            </div>
            {description ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-(--ct-text-muted)">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn(headed && "mt-5")}>{children}</div>
    </section>
  );
}

/** Page-level root — every investor route body starts with this. */
export function Series1Page({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-10">{children}</div>;
}
