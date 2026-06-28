"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/ui/modal";
import {
  BentoLabel,
  BENTO_PRIMARY_BTN,
  BENTO_SECONDARY_BTN,
} from "@/components/ui/bento";
import { createInvestor } from "@/app/admin/customers/actions";

const SELECT_INPUT =
  "bg-surface-inset border border-white/10 focus:border-[#A7FB90]/40 text-white rounded-lg px-4 py-2.5 text-[13px] outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

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
      <button type="button" className={BENTO_PRIMARY_BTN} onClick={() => setOpen(true)}>
        New investor
      </button>

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
            <button type="submit" className={BENTO_PRIMARY_BTN} disabled={isPending}>
              {isPending ? "Creating…" : "Create"}
            </button>
            <button type="button" className={BENTO_SECONDARY_BTN} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
