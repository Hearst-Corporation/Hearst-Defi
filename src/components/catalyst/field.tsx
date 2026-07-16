import { forwardRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { fieldControlClassName } from "./field-controls";

/** Native text input with shared field chrome — prefer over local INPUT_CLASS constants. */
export const TextField = forwardRef(function TextField(
  {
    className,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement>,
  ref: React.ForwardedRef<HTMLInputElement>,
) {
  return (
    <input
      ref={ref}
      className={cn(fieldControlClassName, className)}
      {...props}
    />
  );
});

export function Field({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)} {...props}>
      {children}
    </div>
  );
}

export function FieldLabel({
  className,
  children,
  htmlFor,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("ct-bento-label block", className)}
      {...props}
    >
      {children}
    </label>
  );
}

export function FieldDescription({
  className,
  children,
  id,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      id={id}
      className={cn("ct-metric-caption text-[var(--ct-text-muted)]", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function FieldError({
  className,
  children,
  id,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  if (!children) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cn(
        "text-[length:var(--ct-text-2xs)] text-[var(--ct-status-danger)]",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}

export function FieldGroup({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-5 lg:grid-cols-2", className)}>
      {children}
    </div>
  );
}
