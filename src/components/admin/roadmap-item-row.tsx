"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { safeUrl } from "@/lib/safe-url";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NestedPanel } from "@/components/ui/nested-panel";
import { cn } from "@/lib/cn";
import {
  statusDotClass,
  statusLabel,
  type RoadmapItemWithState,
  type RoadmapStatus,
} from "@/lib/roadmap-types";
import {
  quickSetStatus,
  updateRoadmapItem,
} from "@/app/admin/roadmap/actions";

const STATUSES: RoadmapStatus[] = [
  "todo",
  "in_progress",
  "done",
  "blocked",
  "validated",
];

export function RoadmapItemRow({ item }: { item: RoadmapItemWithState }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function setStatus(next: RoadmapStatus) {
    startTransition(async () => {
      try {
        await quickSetStatus(item.id, next);
        toast.success(`Status → ${statusLabel(next)}`);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Failed to update status: ${message}`);
      }
    });
  }

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await updateRoadmapItem(formData);
        setOpen(false);
        toast.success("Roadmap item updated");
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Failed to save: ${message}`);
      }
    });
  }

  return (
    <NestedPanel className="p-0">
      <div className="flex items-center gap-4 px-5 py-4">
        <span
          role="img"
          aria-label={statusLabel(item.status)}
          className={cn(
            "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
            statusDotClass(item.status),
          )}
          title={statusLabel(item.status)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-base font-medium ct-text-primary">
              {item.label}
            </span>
            <Badge variant="default">{item.owner}</Badge>
            {item.evidenceUrl ? (
              <a
                href={safeUrl(item.evidenceUrl)}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium ct-text-accent underline-offset-2 hover:underline"
              >
                Evidence ↗
              </a>
            ) : null}
            {item.blockers ? <Badge variant="danger">Blocker</Badge> : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs ct-text-muted">
            <span className="mono">{item.id}</span>
            {item.spec_ref ? (
              <span className="mono ct-text-faint">
                · {item.spec_ref}
              </span>
            ) : null}
            {item.validatedBy ? (
              <span>
                · Validated by {item.validatedBy}
                {item.validatedAt
                  ? ` on ${item.validatedAt.toISOString().slice(0, 10)}`
                  : ""}
              </span>
            ) : null}
          </div>
        </div>

        <div className="hidden items-center gap-1 sm:flex">
          {STATUSES.map((s) => (
            <Button
              key={s}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStatus(s)}
              disabled={isPending || item.status === s}
              className={cn(
                "rounded-md px-2.5 py-1.5 disabled:cursor-default",
                item.status === s
                  ? "ct-surface-2 ct-text-primary"
                  : "ct-text-muted hover:ct-surface-2 hover:ct-text-primary",
              )}
              title={statusLabel(s)}
              aria-label={`Set status to ${statusLabel(s)}`}
            >
              <span
                aria-hidden
                className={cn(
                  "inline-block h-2 w-2 rounded-full",
                  statusDotClass(s),
                )}
              />
            </Button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? "Close" : "Details"}
        </Button>
      </div>

      {open ? (
        <form
          action={onSubmit}
          className="space-y-3 border-t border-[var(--ct-border)] p-4"
        >
          <input type="hidden" name="itemId" value={item.id} />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="ct-form-label">
                Status
              </span>
              <select
                name="status"
                defaultValue={item.status}
                className="ct-select"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs">
              <span className="ct-form-label">
                Validated by
              </span>
              <input
                name="validatedBy"
                type="text"
                defaultValue={item.validatedBy ?? ""}
                placeholder="Adrien"
                className="ct-input"
              />
            </label>
          </div>

          <label className="block text-xs">
            <span className="mb-1 block ct-text-muted uppercase tracking-wide">
              Evidence URL
            </span>
            <input
              name="evidenceUrl"
              type="url"
              defaultValue={item.evidenceUrl ?? ""}
              placeholder="https://… preview, PR, screenshot"
              className="ct-input mono"
            />
          </label>

          <label className="block text-xs">
            <span className="mb-1 block ct-text-muted uppercase tracking-wide">
              Notes
            </span>
            <textarea
              name="notes"
              rows={2}
              defaultValue={item.notes ?? ""}
              className="ct-textarea"
            />
          </label>

          <label className="block text-xs">
            <span className="mb-1 block ct-text-muted uppercase tracking-wide">
              Blockers
            </span>
            <textarea
              name="blockers"
              rows={2}
              defaultValue={item.blockers ?? ""}
              placeholder="What's blocking this?"
              className="ct-textarea"
            />
          </label>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      ) : null}
    </NestedPanel>
  );
}
