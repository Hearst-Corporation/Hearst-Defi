"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      richColors={false}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "border border-border bg-surface-raised text-foreground shadow-md",
          title: "text-sm font-medium",
          description: "text-sm text-muted",
          actionButton: "bg-accent text-accent-foreground",
          cancelButton: "bg-surface-overlay text-muted",
        },
      }}
    />
  );
}
