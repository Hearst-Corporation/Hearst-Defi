import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

interface AdminDetailSectionProps {
  id?: string;
  label: string;
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

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
      className={cn("admin-doc-stack admin-doc-stack--actions", className)}
      aria-label={label}
      id={id}
    >
      {title && <h2 className="h2">{title}</h2>}
      {description && (
        <div className="body-xs ct-text-muted">{description}</div>
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
    <Card className="p-(--ct-space-6)" hoverOverlay={false}>
      <dl
        className={cn(
          cols === 2 ? "admin-doc-form-grid-2" : "admin-doc-form-grid",
          "body-sm",
          className,
        )}
      >
        {children}
      </dl>
    </Card>
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
    <div className={cn(fullWidth && "md:col-span-2", className)}>
      <dt className="ct-form-label">{label}</dt>
      <dd className="ct-text-body">{children}</dd>
    </div>
  );
}
