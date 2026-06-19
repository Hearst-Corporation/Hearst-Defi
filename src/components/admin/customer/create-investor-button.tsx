"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Create failed: ${message}`);
      }
    });
  }

  if (!open) {
    return (
      <Button variant="primary" size="md" onClick={() => setOpen(true)}>
        New investor
      </Button>
    );
  }

  return (
    <form action={onSubmit} className="admin-doc-inset admin-doc-stack admin-doc-stack--actions" aria-label="Create investor">
      <div className="admin-doc-stack admin-doc-stack--tight">
        <p className="eyebrow">Provision investor account</p>
        <div className="admin-doc-form-grid-3">
          <label className="admin-doc-field">
            <span className="stat-label">Email</span>
            <input
              name="email"
              type="email"
              required
              placeholder="email@firm.com"
              className="ct-input"
              autoFocus
            />
          </label>
          <label className="admin-doc-field">
            <span className="stat-label">Role</span>
            <select name="role" defaultValue="investor" className="ct-input" aria-label="Role">
              <option value="investor">investor</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <label className="admin-doc-field">
            <span className="stat-label">KYC</span>
            <select name="kycStatus" defaultValue="pending" className="ct-input" aria-label="KYC">
              <option value="pending">KYC pending</option>
              <option value="approved">KYC approved</option>
              <option value="rejected">KYC rejected</option>
            </select>
          </label>
        </div>
      </div>
      <div className="admin-form-actions">
        <Button type="submit" variant="primary" size="md" disabled={isPending}>
          {isPending ? "Creating…" : "Create"}
        </Button>
        <Button type="button" variant="ghost" size="md" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
