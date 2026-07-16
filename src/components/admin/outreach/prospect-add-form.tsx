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

  return (
    <>
      <CockpitButton
        type="button"
        variant="primary"
        shape="rect"
        size="lg"
        onClick={() => setOpen(true)}
      >
        Add prospect
      </CockpitButton>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Add prospect"
        className="max-w-2xl"
      >
        <form
          ref={formRef}
          action={onSubmit}
          className="flex flex-col gap-4"
          aria-label="Add prospect"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className={BENTO_FIELD} htmlFor="prospect-email">
              <span className={BENTO_FIELD_LABEL}>Email</span>
              <input
                id="prospect-email"
                name="email"
                type="email"
                required
                placeholder="lp@firm.com"
                className={BENTO_INPUT}
                autoFocus
              />
            </label>
            <label className={BENTO_FIELD} htmlFor="prospect-company">
              <span className={BENTO_FIELD_LABEL}>Company</span>
              <input
                id="prospect-company"
                name="company"
                type="text"
                placeholder="Firm name"
                className={BENTO_INPUT}
              />
            </label>
            <label className={BENTO_FIELD} htmlFor="prospect-firstName">
              <span className={BENTO_FIELD_LABEL}>First name</span>
              <input
                id="prospect-firstName"
                name="firstName"
                type="text"
                placeholder="Jane"
                className={BENTO_INPUT}
              />
            </label>
            <label className={BENTO_FIELD} htmlFor="prospect-lastName">
              <span className={BENTO_FIELD_LABEL}>Last name</span>
              <input
                id="prospect-lastName"
                name="lastName"
                type="text"
                placeholder="Doe"
                className={BENTO_INPUT}
              />
            </label>
            <label className={BENTO_FIELD} htmlFor="prospect-title">
              <span className={BENTO_FIELD_LABEL}>Title</span>
              <input
                id="prospect-title"
                name="title"
                type="text"
                placeholder="Head of Treasury"
                className={BENTO_INPUT}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <CockpitButton
              type="submit"
              variant="primary"
              shape="rect"
              size="lg"
              disabled={isPending}
            >
              {isPending ? "Adding…" : "Add"}
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
