"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
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
      <EmptySurface
        variant="widget"
        message="No feedback logged yet."
        className="min-h-32"
      />
    );
  }

  return (
    <div className="admin-doc-stack admin-doc-stack--actions">
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
    <Card className={cn(item.resolved && "opacity-(--ct-opacity-60)")} hoverOverlay={false}>
      <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--start admin-doc-inline-row--actions">
        <div className="min-w-0 flex-1">
          <div className="mb-2 admin-doc-inline-row body-xs ct-text-muted">
            <time>{item.createdAt.toISOString().slice(0, 16).replace("T", " ")}</time>
            {item.author ? <span>· {item.author}</span> : null}
            {item.itemId ? (
              <Badge variant="default">item: {item.itemId}</Badge>
            ) : null}
            {item.pathname ? (
              <span className="mono">{item.pathname}</span>
            ) : null}
            {item.resolved ? <Badge variant="success">Resolved</Badge> : null}
          </div>
          <p className="whitespace-pre-wrap body-sm ct-text-body">
            {item.message}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          disabled={isPending}
        >
          {item.resolved ? "Reopen" : "Resolve"}
        </Button>
      </div>
    </Card>
  );
}
