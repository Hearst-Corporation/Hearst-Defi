"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  quickSetStatus,
  updateRoadmapItem,
} from "@/app/admin/roadmap/actions";
import { BENTO_PRIMARY_BTN, BentoLabel } from "@/components/ui/bento";
import { Modal } from "@/components/ui/modal";
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

const INPUT_CLASS =
  "mt-2 w-full rounded-lg border border-white/10 bg-surface-inset px-3 py-2.5 text-[length:var(--ct-text-xs)] text-white placeholder:text-zinc-600 transition-colors focus:border-[color-mix(in_srgb,var(--ct-accent)_40%,transparent)] focus:outline-none";

const GHOST_BTN =
  "rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[length:var(--ct-text-2xs)] font-medium text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50";

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
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            role="img"
            aria-label={statusLabel(item.status)}
            className={cn(
              "mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full",
              statusDotClass(item.status),
            )}
            title={statusLabel(item.status)}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-[length:var(--ct-text-xs)] font-medium text-white">
              {item.label}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                {item.owner}
              </span>
              {item.evidenceUrl ? (
                <Link
                  href={safeUrl(item.evidenceUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[length:var(--ct-text-2xs)] font-medium text-[var(--ct-accent)] underline-offset-2 hover:underline"
                >
                  Evidence ↗
                </Link>
              ) : null}
              {item.blockers ? (
                <span className="inline-flex items-center rounded-md border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300">
                  Blocker
                </span>
              ) : null}
            </div>
            {item.validatedBy && !open ? (
              <p className="m-0 text-[length:var(--ct-text-2xs)] text-zinc-500">
                Validated by {item.validatedBy}
                {item.validatedAt
                  ? ` · ${item.validatedAt.toISOString().slice(0, 10)}`
                  : ""}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-start gap-2 self-end lg:self-start">
          <div className="hidden items-center gap-1.5 sm:flex">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                disabled={isPending || item.status === s}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md border transition-colors disabled:cursor-default",
                  item.status === s
                    ? "border-white/10 bg-white/10"
                    : "border-transparent text-zinc-500 hover:border-white/10 hover:bg-white/5",
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
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-controls={formId}
            className={GHOST_BTN}
          >
            {open ? "Close" : "Details"}
          </button>
        </div>
      </div>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={item.label}
        className="max-w-2xl"
      >
        <form
          id={formId}
          action={onSubmit}
          className="flex flex-col gap-y-5"
          aria-label={`Edit ${item.label}`}
        >
          <input type="hidden" name="itemId" value={item.id} />

          <p className="m-0 font-mono text-[length:var(--ct-text-2xs)] text-zinc-500">
            {item.id}
            {item.spec_ref ? ` · ${item.spec_ref}` : ""}
          </p>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <label className="block" htmlFor={`${formId}-status`}>
              <BentoLabel>Status</BentoLabel>
              <select
                id={`${formId}-status`}
                name="status"
                defaultValue={item.status}
                className={INPUT_CLASS}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block" htmlFor={`${formId}-validatedBy`}>
              <BentoLabel>Validated by</BentoLabel>
              <input
                id={`${formId}-validatedBy`}
                name="validatedBy"
                type="text"
                defaultValue={item.validatedBy ?? ""}
                placeholder="Adrien"
                className={INPUT_CLASS}
              />
            </label>
          </div>

          <label className="block" htmlFor={`${formId}-evidenceUrl`}>
            <BentoLabel>Evidence URL</BentoLabel>
            <input
              id={`${formId}-evidenceUrl`}
              name="evidenceUrl"
              type="url"
              defaultValue={item.evidenceUrl ?? ""}
              placeholder="https://… preview, PR, screenshot"
              className={`${INPUT_CLASS} font-mono`}
            />
          </label>

          <label className="block" htmlFor={`${formId}-notes`}>
            <BentoLabel>Notes</BentoLabel>
            <textarea
              id={`${formId}-notes`}
              name="notes"
              rows={2}
              defaultValue={item.notes ?? ""}
              className={`${INPUT_CLASS} resize-y leading-relaxed`}
            />
          </label>

          <label className="block" htmlFor={`${formId}-blockers`}>
            <BentoLabel>Blockers</BentoLabel>
            <textarea
              id={`${formId}-blockers`}
              name="blockers"
              rows={2}
              defaultValue={item.blockers ?? ""}
              placeholder="What's blocking this?"
              className={`${INPUT_CLASS} resize-y leading-relaxed`}
            />
          </label>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className={GHOST_BTN}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              className={BENTO_PRIMARY_BTN}
            >
              {isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
