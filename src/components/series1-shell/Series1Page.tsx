import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

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
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">{description}</p>
        ) : null}
      </div>
      <div className="flex min-w-0 items-center gap-3">
        {meta ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{meta}</p> : null}
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
      className={cn(headed && "border-t border-zinc-950/5 pt-8 dark:border-white/10", className)}
    >
      {headed ? (
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div>
            <div className="flex items-center gap-3">
              {index ? (
                <span className="flex size-7 items-center justify-center rounded-md bg-zinc-100 text-xs font-semibold text-zinc-500 tabular-nums dark:bg-white/5 dark:text-zinc-400">
                  {index}
                </span>
              ) : null}
              {title ? (
                <h2 className="text-base font-semibold text-zinc-950 dark:text-white">{title}</h2>
              ) : null}
            </div>
            {description ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
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
