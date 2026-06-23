"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { addProspect } from "@/app/admin/outreach/actions";

/**
 * Inline "add prospect" disclosure form above the prospects table. Submits a
 * single prospect (email + optional identity) to the addProspect server action.
 * On success the action revalidates the list; toast only fires on error.
 */
export function ProspectAddForm() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await addProspect(formData);
        toast.success("Prospect added");
        formRef.current?.reset();
        setOpen(false);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Add failed: ${message}`);
      }
    });
  }

  if (!open) {
    return (
      <Button variant="primary" size="md" onClick={() => setOpen(true)}>
        Add prospect
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={onSubmit}
      className="admin-doc-inset admin-doc-stack admin-doc-stack--actions w-full"
      aria-label="Add prospect"
    >
      <div className="admin-doc-stack admin-doc-stack--tight">
        <p className="eyebrow">Add prospect</p>
        <div className="admin-doc-form-grid-2">
          <label className="admin-doc-field" htmlFor="prospect-email">
            <span className="stat-label">Email</span>
            <input
              id="prospect-email"
              name="email"
              type="email"
              required
              placeholder="lp@firm.com"
              className="ct-input"
              autoFocus
            />
          </label>
          <label className="admin-doc-field" htmlFor="prospect-company">
            <span className="stat-label">Company</span>
            <input
              id="prospect-company"
              name="company"
              type="text"
              placeholder="Firm name"
              className="ct-input"
            />
          </label>
          <label className="admin-doc-field" htmlFor="prospect-firstName">
            <span className="stat-label">First name</span>
            <input
              id="prospect-firstName"
              name="firstName"
              type="text"
              placeholder="Jane"
              className="ct-input"
            />
          </label>
          <label className="admin-doc-field" htmlFor="prospect-lastName">
            <span className="stat-label">Last name</span>
            <input
              id="prospect-lastName"
              name="lastName"
              type="text"
              placeholder="Doe"
              className="ct-input"
            />
          </label>
          <label className="admin-doc-field" htmlFor="prospect-title">
            <span className="stat-label">Title</span>
            <input
              id="prospect-title"
              name="title"
              type="text"
              placeholder="Head of Treasury"
              className="ct-input"
            />
          </label>
        </div>
      </div>
      <div className="admin-form-actions">
        <Button type="submit" variant="primary" size="md" disabled={isPending}>
          {isPending ? "Adding…" : "Add"}
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
