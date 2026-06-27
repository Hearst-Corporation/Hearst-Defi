import type { ReactNode } from "react";

import { BentoPanel } from "@/components/ui/bento";
import { cn } from "@/lib/cn";

interface AdminDetailSectionProps {
  id?: string;
  label: string;
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Admin detail section — Portfolio bento canon.
 * Optional uppercase-ish title + muted description, then the section body.
 * Vertical rhythm matches the product surfaces (gap-4).
 */
export function AdminDetailSection({
  id,
  label,
  title,
  description,
  children,
  className,
}: AdminDetailSectionProps) {
  return (
    <section
      className={cn("flex flex-col gap-4", className)}
      aria-label={label}
      id={id}
    >
      {title && (
        <h2 className="text-[15px] font-semibold tracking-tight text-white">
          {title}
        </h2>
      )}
      {description && (
        <div className="text-[12px] leading-relaxed text-zinc-500">
          {description}
        </div>
      )}
      {children}
    </section>
  );
}

interface AdminDetailGridProps {
  children: ReactNode;
  className?: string;
  cols?: 1 | 2;
}

export function AdminDetailGrid({
  children,
  className,
  cols = 2,
}: AdminDetailGridProps) {
  return (
    <BentoPanel className="p-6">
      <dl
        className={cn(
          "grid grid-cols-1 gap-x-8 gap-y-5",
          cols === 2 && "md:grid-cols-2",
          className,
        )}
      >
        {children}
      </dl>
    </BentoPanel>
  );
}

interface AdminDetailItemProps {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
}

export function AdminDetailItem({
  label,
  children,
  className,
  fullWidth,
}: AdminDetailItemProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", fullWidth && "md:col-span-2", className)}>
      <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
        {label}
      </dt>
      <dd className="m-0 text-[13px] leading-snug text-zinc-200">{children}</dd>
    </div>
  );
}
