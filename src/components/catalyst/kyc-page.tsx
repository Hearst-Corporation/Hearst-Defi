import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function KycPageTitle({
  title,
  meta,
  actions,
  description,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  description?: ReactNode;
}) {
  return (
    <header className="kyc-cockpit-page-title flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">{description}</p> : null}
      </div>
      <div className="flex min-w-0 items-center gap-3">
        {meta ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{meta}</p> : null}
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function KycSection({
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
    <section className={cn("kyc-cockpit-section", headed && "pt-8", className)}>
      {headed ? (
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div>
            <div className="flex items-center gap-3">
              {index ? <span className="flex size-7 items-center justify-center rounded-md bg-zinc-200 text-xs font-semibold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{index}</span> : null}
              {title ? <h2 className="text-base font-semibold text-zinc-950 dark:text-white">{title}</h2> : null}
            </div>
            {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn(headed && "mt-5")}>{children}</div>
    </section>
  );
}

export function KycPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("kyc-cockpit-panel overflow-hidden rounded-xl", className)}>{children}</div>;
}

export function KycChartSurface({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn("kyc-cockpit-chart flex h-full min-h-72 flex-col rounded-xl p-5 sm:p-6", className)}>
      <figcaption className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">{title}</h3>
          {description ? <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </figcaption>
      <div className="flex min-h-0 flex-1 flex-col justify-center">{children}</div>
    </figure>
  );
}

export function KycEmptyChart({
  label,
  detail,
}: {
  label: string;
  detail: string;
}) {
  return (
    <div className="kyc-cockpit-empty flex min-h-40 flex-1 flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
      <p className="text-sm font-medium text-zinc-950 dark:text-white">{label}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-500 dark:text-zinc-400">{detail}</p>
    </div>
  );
}

export function KycHeroKpiBand({
  hero,
  metrics,
}: {
  hero: { label: string; value: ReactNode; hint: ReactNode };
  metrics: Array<{ label: string; value: ReactNode; hint?: ReactNode }>;
}) {
  return (
    <div className="kyc-cockpit-kpi overflow-hidden rounded-xl">
      <div className="grid gap-px lg:grid-cols-12">
        <div className="px-6 py-7 lg:col-span-4">
          <p className="text-xs font-semibold uppercase tracking-uppercase text-emerald-600 dark:text-emerald-400">{hero.label}</p>
          <div className="mt-3 truncate text-4xl font-semibold tracking-tight tabular-nums text-zinc-950 sm:text-5xl dark:text-white">{hero.value}</div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{hero.hint}</p>
        </div>
        <dl className="grid grid-cols-2 gap-px lg:col-span-8 lg:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="px-4 py-4">
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{metric.label}</dt>
              <dd className="mt-1 truncate text-xl font-semibold tracking-tight tabular-nums text-zinc-950 dark:text-white">{metric.value}</dd>
              {metric.hint ? <p className="mt-0.5 truncate text-[10px] text-zinc-400 dark:text-zinc-500">{metric.hint}</p> : null}
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
