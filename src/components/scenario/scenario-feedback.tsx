"use client";

import { cn } from "@/lib/cn";

export function ScenarioErrorBanner({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-full border border-(--ct-status-danger) bg-transparent px-(--ct-space-4) py-2.5 body-sm ct-status-danger"
    >
      {message}
    </p>
  );
}

export function ScenarioPendingOverlay({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-[var(--ct-z-overlay)] flex items-center justify-center rounded-lg border border-[var(--ct-border-soft)] bg-transparent",
        className,
      )}
    >
      <span className="body-sm ct-text-body">{message}</span>
    </div>
  );
}
