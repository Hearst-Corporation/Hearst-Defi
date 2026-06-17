"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  quickSetStatus,
  updateRoadmapItem,
} from "@/app/admin/roadmap/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { safeUrl } from "@/lib/safe-url";
import {
  statusDotClass,
  statusLabel,
  type RoadmapItemWithState,
  type RoadmapStatus,
} from "@/lib/roadmap-types";

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
  const formId = useId();

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
    <div className="ct-roadmap-item-row" aria-label={item.label}>
      <div className="flex min-w-0 flex-col gap-(--ct-space-4) lg:flex-row lg:items-start lg:justify-between">
        <div className="admin-doc-inline-row admin-doc-inline-row--relaxed items-start min-w-0 flex-1">
          <span
            role="img"
            aria-label={statusLabel(item.status)}
            className={cn(
              "mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full",
              statusDotClass(item.status),
            )}
            title={statusLabel(item.status)}
          />
          <div className="min-w-0 flex-1 admin-doc-stack admin-doc-stack--tight">
            <span className="body-sm font-medium ct-text-primary">
              {item.label}
            </span>
            <div className="admin-doc-inline-row admin-doc-inline-row--tight body-xs">
              <Badge variant="default">{item.owner}</Badge>
              {item.evidenceUrl ? (
                <a
                  href={safeUrl(item.evidenceUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium ct-text-accent underline-offset-2 hover:underline"
                >
                  Evidence ↗
                </a>
              ) : null}
              {item.blockers ? <Badge variant="danger">Blocker</Badge> : null}
            </div>
            {item.validatedBy && !open ? (
              <p className="body-xs ct-text-faint m-0">
                Validated by {item.validatedBy}
                {item.validatedAt
                  ? ` · ${item.validatedAt.toISOString().slice(0, 10)}`
                  : ""}
              </p>
            ) : null}
          </div>
        </div>

        <div className="admin-doc-inline-row admin-doc-inline-row--tight items-start self-end lg:self-start">
          <div className="hidden admin-doc-inline-row admin-doc-inline-row--tight sm:flex">
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
                    : "ct-text-muted hover:bg-(--ct-surface-2) hover:ct-text-primary",
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
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-controls={formId}
          >
            {open ? "Close" : "Details"}
          </Button>
        </div>
      </div>

      {open ? (
        <form
          id={formId}
          action={onSubmit}
          className="admin-doc-stack admin-doc-stack--actions border-t border-(--ct-border-soft) pt-[var(--ct-space-5)]"
          aria-label={`Edit ${item.label}`}
        >
          <input type="hidden" name="itemId" value={item.id} />

          <p className="body-xs ct-text-faint mono m-0">
            {item.id}
            {item.spec_ref ? ` · ${item.spec_ref}` : ""}
          </p>

          <div className="admin-doc-form-grid-2">
            <label className="block body-xs" htmlFor={`${formId}-status`}>
              <span className="ct-form-label">Status</span>
              <select
                id={`${formId}-status`}
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

            <label className="block body-xs" htmlFor={`${formId}-validatedBy`}>
              <span className="ct-form-label">Validated by</span>
              <input
                id={`${formId}-validatedBy`}
                name="validatedBy"
                type="text"
                defaultValue={item.validatedBy ?? ""}
                placeholder="Adrien"
                className="ct-input"
              />
            </label>
          </div>

          <label className="block body-xs" htmlFor={`${formId}-evidenceUrl`}>
            <span className="ct-form-label">Evidence URL</span>
            <input
              id={`${formId}-evidenceUrl`}
              name="evidenceUrl"
              type="url"
              defaultValue={item.evidenceUrl ?? ""}
              placeholder="https://… preview, PR, screenshot"
              className="ct-input mono"
            />
          </label>

          <label className="block body-xs" htmlFor={`${formId}-notes`}>
            <span className="ct-form-label">Notes</span>
            <textarea
              id={`${formId}-notes`}
              name="notes"
              rows={2}
              defaultValue={item.notes ?? ""}
              className="ct-textarea"
            />
          </label>

          <label className="block body-xs" htmlFor={`${formId}-blockers`}>
            <span className="ct-form-label">Blockers</span>
            <textarea
              id={`${formId}-blockers`}
              name="blockers"
              rows={2}
              defaultValue={item.blockers ?? ""}
              placeholder="What's blocking this?"
              className="ct-textarea"
            />
          </label>

          <div className="admin-doc-inline-row justify-end">
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
              aria-busy={isPending}
            >
              {isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
