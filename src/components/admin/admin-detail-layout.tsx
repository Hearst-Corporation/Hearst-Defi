import type { ReactNode } from "react";

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
      {title && <h2 className="ct-section-title">{title}</h2>}
      {description && (
        <div className="text-[length:var(--ct-text-xs)] leading-relaxed text-[var(--ct-text-muted)]">
          {description}
        </div>
      )}
      {children}
    </section>
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
      <dt className="ct-bento-label">{label}</dt>
      <dd className="m-0 text-[length:var(--ct-text-xs)] leading-snug text-[var(--ct-text-body)]">
        {children}
      </dd>
    </div>
  );
}
