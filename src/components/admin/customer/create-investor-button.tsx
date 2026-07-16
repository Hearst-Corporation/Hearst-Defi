"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/catalyst/modal";
import {
  BentoLabel,
} from "@/components/catalyst/bento";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { createInvestor } from "@/app/admin/customers/actions";

// Shared tokenized form control — canonical `.ct-input/.ct-select/.ct-textarea`
// (cockpit.css), token-only. Replaces a hardcoded class string that was copy-
// pasted across 5 customer forms (#A7FB90 / border-white / text-white / text-[length:var(--ct-text-xs)]).
const SELECT_INPUT = "ct-select";

/** Admin "create investor" — disclosure form above the directory table. */
export function CreateInvestorButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await createInvestor(formData);
        // Success redirects to the new customer's detail page.
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Create failed: ${message}`);
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
        New investor
      </CockpitButton>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Provision investor account"
        className="max-w-2xl"
      >
        <form action={onSubmit} className="flex flex-col gap-5" aria-label="Create investor">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2">
              <BentoLabel>Email</BentoLabel>
              <input
                name="email"
                type="email"
                required
                placeholder="email@firm.com"
                className={SELECT_INPUT}
                autoFocus
              />
            </label>
            <label className="flex flex-col gap-2">
              <BentoLabel>Role</BentoLabel>
              <select name="role" defaultValue="investor" className={SELECT_INPUT} aria-label="Role">
                <option value="investor">investor</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <BentoLabel>KYC</BentoLabel>
              <select name="kycStatus" defaultValue="pending" className={SELECT_INPUT} aria-label="KYC">
                <option value="pending">KYC pending</option>
                <option value="approved">KYC approved</option>
                <option value="rejected">KYC rejected</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <CockpitButton
              type="submit"
              variant="primary"
              shape="rect"
              size="lg"
              disabled={isPending}
            >
              {isPending ? "Creating…" : "Create"}
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
