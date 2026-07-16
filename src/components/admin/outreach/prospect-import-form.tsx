"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/catalyst/modal";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import {
  BENTO_FIELD,
  BENTO_FIELD_LABEL,
  BENTO_INPUT,
} from "@/components/admin/outreach/bento-form";
import { importProspects } from "@/app/admin/outreach/actions";

/**
 * Bulk paste-to-import: a textarea where the admin pastes one email per line
 * (optionally `email,company` or `email,first,last`). Hands the raw text to the
 * importProspects server action, which parses + de-dupes server-side and returns
 * a count. The action revalidates the list on success.
 */
export function ProspectImportForm() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        const result = await importProspects(formData);
        const added = result?.added ?? 0;
        const skipped = result?.skipped ?? 0;
        toast.success(
          `Imported ${added} prospect${added === 1 ? "" : "s"}` +
            (skipped > 0 ? ` · ${skipped} skipped` : ""),
        );
        formRef.current?.reset();
        setOpen(false);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Import failed: ${message}`);
      }
    });
  }

  return (
    <>
      <CockpitButton
        type="button"
        variant="secondary"
        shape="rect"
        size="lg"
        onClick={() => setOpen(true)}
      >
        Import emails
      </CockpitButton>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Import prospects"
        className="max-w-2xl"
      >
        <form
          ref={formRef}
          action={onSubmit}
          className="flex flex-col gap-4"
          aria-label="Import prospects"
        >
          <label className={BENTO_FIELD} htmlFor="import-raw">
            <span className={BENTO_FIELD_LABEL}>
              One per line — email, or email,company, or email,first,last
            </span>
            <textarea
              id="import-raw"
              name="raw"
              rows={6}
              required
              placeholder={
                "lp@firm.com\ntreasury@fund.io, Acme Capital\njane@spv.co, Jane, Doe"
              }
              className={BENTO_INPUT}
              autoFocus
            />
          </label>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <CockpitButton
              type="submit"
              variant="primary"
              shape="rect"
              size="lg"
              disabled={isPending}
            >
              {isPending ? "Importing…" : "Import"}
            </CockpitButton>
            <CockpitButton
              type="button"
              variant="secondary"
              shape="rect"
              size="lg"
              onClick={() => setOpen(false)}
            >
              Cancel
            </CockpitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
