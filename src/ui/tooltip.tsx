"use client";

import { cn } from "@/lib/cn";

export function Tooltip({
  content,
  children,
  className,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("group relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-(--z-overlay) mb-2 -translate-x-1/2",
          "rounded-md border border-border bg-surface-overlay px-2 py-1 text-xs text-foreground",
          "opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
          "whitespace-nowrap",
        )}
      >
        {content}
      </span>
    </span>
  );
}
