"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Import emails
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={onSubmit}
      className="admin-doc-inset admin-doc-stack admin-doc-stack--actions"
      aria-label="Import prospects"
    >
      <div className="admin-doc-stack admin-doc-stack--tight">
        <p className="eyebrow">Import prospects</p>
        <label className="admin-doc-field" htmlFor="import-raw">
          <span className="stat-label">
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
            className="ct-input"
            autoFocus
          />
        </label>
      </div>
      <div className="admin-form-actions">
        <Button type="submit" variant="primary" size="md" disabled={isPending}>
          {isPending ? "Importing…" : "Import"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
