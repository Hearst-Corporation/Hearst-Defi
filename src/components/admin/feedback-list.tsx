"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/cn";
import { toggleResolved } from "@/app/admin/feedback/actions";

interface FeedbackItem {
  id: string;
  createdAt: Date;
  itemId: string | null;
  pathname: string | null;
  message: string;
  author: string | null;
  resolved: boolean;
}

export function FeedbackList({ items }: { items: FeedbackItem[] }) {
  if (items.length === 0) {
    return (
      <div className="p-5 lg:p-6">
        <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--ct-border)] bg-surface-inset p-8 text-center">
          <p className="ct-metric-value text-[var(--ct-text-secondary)]">
            No feedback logged yet.
          </p>
          <p className="ct-metric-caption">
            Submit the first note using the form above.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {items.map((item) => (
        <FeedbackRow key={item.id} item={item} />
      ))}
    </div>
  );
}

function FeedbackRow({ item }: { item: FeedbackItem }) {
  const [isPending, startTransition] = useTransition();

  function onToggle() {
    const next = !item.resolved;
    startTransition(async () => {
      try {
        await toggleResolved(item.id, next);
        toast.success(next ? "Feedback resolved" : "Feedback reopened");
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Failed to update feedback: ${message}`);
      }
    });
  }

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-[var(--ct-border-soft)] px-5 py-4 last:border-b-0 lg:px-6",
        item.resolved && "opacity-50",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="ct-metric-caption mb-2 flex flex-wrap items-center gap-2">
          <time>
            {item.createdAt.toISOString().slice(0, 16).replace("T", " ")}
          </time>
          {item.author ? <span>· {item.author}</span> : null}
          {item.itemId ? (
            <span className="ct-bento-label inline-flex items-center rounded-md border border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] px-2 py-0.5">
              Item {item.itemId}
            </span>
          ) : null}
          {item.pathname ? (
            <span className="font-mono">{item.pathname}</span>
          ) : null}
          {item.resolved ? (
            <span className="ct-bento-label inline-flex items-center rounded-md border border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] px-2 py-0.5 text-[var(--ct-accent)]">
              Resolved
            </span>
          ) : null}
        </div>
        <p className="ct-metric-value whitespace-pre-wrap font-normal leading-relaxed text-[var(--ct-text-secondary)]">
          {item.message}
        </p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={isPending}
        className="ct-metric-caption shrink-0 rounded-lg border border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] px-3 py-1.5 font-medium text-[var(--ct-text-strong)] transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_10%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {item.resolved ? "Reopen" : "Resolve"}
      </button>
    </div>
  );
}
