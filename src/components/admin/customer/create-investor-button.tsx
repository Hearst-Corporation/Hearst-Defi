"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/catalyst/modal";
import {
  BentoLabel,
} from "@/components/catalyst/bento";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { Input } from "@/components/catalyst/input";
import { Select } from "@/components/catalyst/select";
import { createInvestor } from "@/app/admin/customers/actions";

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
        // createInvestor() ends with redirect(), which Next.js signals by
        // THROWING — swallowing it here would turn every success into a fake
        // "Create failed" toast (the WIRE-2 trap). Let the framework handle it.
        if (
          e !== null &&
          typeof e === "object" &&
          "digest" in e &&
          String((e as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
        ) {
          throw e;
        }
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
              <Input
                name="email"
                type="email"
                required
                placeholder="email@firm.com"
                autoFocus
              />
            </label>
            <label className="flex flex-col gap-2">
              <BentoLabel>Role</BentoLabel>
              <Select name="role" defaultValue="investor" aria-label="Role">
                <option value="investor">investor</option>
                <option value="admin">admin</option>
              </Select>
            </label>
            <label className="flex flex-col gap-2">
              <BentoLabel>KYC</BentoLabel>
              <Select name="kycStatus" defaultValue="pending" aria-label="KYC">
                <option value="pending">KYC pending</option>
                <option value="approved">KYC approved</option>
                <option value="rejected">KYC rejected</option>
              </Select>
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
