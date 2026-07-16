"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  quickSetStatus,
  updateRoadmapItem,
} from "@/app/admin/roadmap/actions";
import { BentoLabel } from "@/components/catalyst/bento";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { TextField } from "@/components/catalyst/field";
import { Select } from "@/components/catalyst/select";
import { Textarea } from "@/components/catalyst/textarea";
import { Modal } from "@/components/catalyst/modal";
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
            <span className="text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-text-strong)]">
              {item.label}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md border border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] px-2 py-0.5 text-[length:var(--ct-text-deci)] font-bold uppercase tracking-wider text-[var(--ct-text-muted)]">
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
                <span className="inline-flex items-center rounded-md border border-[var(--ct-status-danger-border)] bg-[var(--ct-status-danger-soft)] px-2 py-0.5 text-[length:var(--ct-text-deci)] font-bold uppercase tracking-wider text-[var(--ct-status-danger)]">
                  Blocker
                </span>
              ) : null}
            </div>
            {item.validatedBy && !open ? (
              <p className="m-0 text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)]">
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
              <CockpitButton
                key={s}
                type="button"
                variant="quiet"
                shape="rect"
                size="icon"
                onClick={() => setStatus(s)}
                disabled={isPending || item.status === s}
                className={cn(
                  "h-7 w-7 rounded-md border transition-colors disabled:cursor-default",
                  item.status === s
                    ? "border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_10%,transparent)]"
                    : "border-transparent text-[var(--ct-text-faint)] hover:border-[var(--ct-border)] hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)]",
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
              </CockpitButton>
            ))}
          </div>

          <CockpitButton
            type="button"
            variant="secondary"
            shape="rect"
            size="sm"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-controls={formId}
          >
            {open ? "Close" : "Details"}
          </CockpitButton>
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

          <p className="m-0 mono text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)]">
            {item.id}
            {item.spec_ref ? ` · ${item.spec_ref}` : ""}
          </p>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <label className="block" htmlFor={`${formId}-status`}>
              <BentoLabel>Status</BentoLabel>
              <Select
                id={`${formId}-status`}
                name="status"
                defaultValue={item.status}
                className="mt-2"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block" htmlFor={`${formId}-validatedBy`}>
              <BentoLabel>Validated by</BentoLabel>
              <TextField
                id={`${formId}-validatedBy`}
                name="validatedBy"
                type="text"
                defaultValue={item.validatedBy ?? ""}
                placeholder="Adrien"
                className="mt-2"
              />
            </label>
          </div>

          <label className="block" htmlFor={`${formId}-evidenceUrl`}>
            <BentoLabel>Evidence URL</BentoLabel>
            <TextField
              id={`${formId}-evidenceUrl`}
              name="evidenceUrl"
              type="url"
              defaultValue={item.evidenceUrl ?? ""}
              placeholder="https://… preview, PR, screenshot"
              className="mono mt-2"
            />
          </label>

          <label className="block" htmlFor={`${formId}-notes`}>
            <BentoLabel>Notes</BentoLabel>
            <Textarea
              id={`${formId}-notes`}
              name="notes"
              rows={2}
              defaultValue={item.notes ?? ""}
              className="mt-2"
            />
          </label>

          <label className="block" htmlFor={`${formId}-blockers`}>
            <BentoLabel>Blockers</BentoLabel>
            <Textarea
              id={`${formId}-blockers`}
              name="blockers"
              rows={2}
              defaultValue={item.blockers ?? ""}
              placeholder="What's blocking this?"
              className="mt-2"
            />
          </label>

          <div className="flex justify-end gap-2">
            <CockpitButton
              type="button"
              variant="secondary"
              shape="rect"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </CockpitButton>
            <CockpitButton
              type="submit"
              variant="primary"
              shape="rect"
              size="lg"
              disabled={isPending}
              aria-busy={isPending}
            >
              {isPending ? "Saving…" : "Save"}
            </CockpitButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
