import { forwardRef } from "react";

import { cn } from "@/lib/cn";

import { fieldControlClassName } from "./field-controls";

export const Textarea = forwardRef(function Textarea(
  {
    className,
    ...props
  }: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  ref: React.ForwardedRef<HTMLTextAreaElement>,
) {
  return (
    <textarea
      ref={ref}
      className={cn(fieldControlClassName, "resize-y leading-relaxed", className)}
      {...props}
    />
  );
});
