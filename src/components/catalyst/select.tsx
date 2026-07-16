import { forwardRef } from "react";

import { cn } from "@/lib/cn";

import { fieldControlClassName } from "./field-controls";

export const Select = forwardRef(function Select(
  {
    className,
    children,
    ...props
  }: React.SelectHTMLAttributes<HTMLSelectElement>,
  ref: React.ForwardedRef<HTMLSelectElement>,
) {
  return (
    <select
      ref={ref}
      className={cn(fieldControlClassName, className)}
      {...props}
    >
      {children}
    </select>
  );
});
