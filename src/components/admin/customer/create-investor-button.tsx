"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createInvestor } from "@/app/admin/customers/actions";

/** Admin "create investor" — inline disclosure form above the directory table. */
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

  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        New investor
      </Button>
    );
  }

  return (
    <form
      action={onSubmit}
      className="admin-doc-inline-row flex-wrap gap-2"
      aria-label="Create investor"
    >
      <input
        name="email"
        type="email"
        required
        placeholder="email@firm.com"
        className="ct-input"
        autoFocus
      />
      <select name="role" defaultValue="investor" className="ct-input" aria-label="Role">
        <option value="investor">investor</option>
        <option value="admin">admin</option>
      </select>
      <select name="kycStatus" defaultValue="pending" className="ct-input" aria-label="KYC">
        <option value="pending">KYC pending</option>
        <option value="approved">KYC approved</option>
        <option value="rejected">KYC rejected</option>
      </select>
      <Button type="submit" variant="primary" disabled={isPending}>
        {isPending ? "Creating…" : "Create"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}
