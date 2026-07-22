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
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: "var(--s1-muted)" }}>
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex min-w-0 items-center gap-3">
        {meta ? (
          <p className="text-xs" style={{ color: "var(--s1-muted)" }}>
            {meta}
          </p>
        ) : null}
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
    <section className={cn(headed && "border-t pt-8", className)} style={headed ? { borderColor: "var(--s1-line-strong)" } : undefined}>
      {headed ? (
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div>
            <div className="flex items-center gap-3">
              {index ? (
                <span
                  className="flex size-7 items-center justify-center rounded-md text-xs font-semibold tabular-nums"
                  style={{
                    background: "var(--s1-inset)",
                    color: "var(--s1-muted)",
                    boxShadow: "var(--s1-shadow-inset)",
                  }}
                >
                  {index}
                </span>
              ) : null}
              {title ? <h2 className="text-base font-semibold">{title}</h2> : null}
            </div>
            {description ? (
              <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: "var(--s1-muted)" }}>
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
