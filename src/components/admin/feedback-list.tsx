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
        <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-surface-inset p-8 text-center">
          <p className="text-[13px] font-medium text-zinc-300">
            No feedback logged yet.
          </p>
          <p className="text-[12px] text-zinc-500">
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
        "flex items-start justify-between gap-4 border-b border-white/5 px-5 py-4 last:border-b-0 lg:px-6",
        item.resolved && "opacity-50",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px] text-zinc-500">
          <time>
            {item.createdAt.toISOString().slice(0, 16).replace("T", " ")}
          </time>
          {item.author ? <span>· {item.author}</span> : null}
          {item.itemId ? (
            <span className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Item {item.itemId}
            </span>
          ) : null}
          {item.pathname ? (
            <span className="font-mono">{item.pathname}</span>
          ) : null}
          {item.resolved ? (
            <span className="inline-flex items-center rounded-md border border-[#A7FB90]/30 bg-[#A7FB90]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#A7FB90]">
              Resolved
            </span>
          ) : null}
        </div>
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-300">
          {item.message}
        </p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={isPending}
        className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {item.resolved ? "Reopen" : "Resolve"}
      </button>
    </div>
  );
}
