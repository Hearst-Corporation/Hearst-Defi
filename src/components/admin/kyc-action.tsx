"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { setInvestorKyc } from "@/app/admin/customers/actions";

/**
 * Admin KYC override control. Renders inline in the customers table. "Approve"
 * appears when the investor is not yet approved; "Reset" appears when they are.
 * Submits the admin-only `setInvestorKyc` server action. Reset is destructive
 * (returns the investor to pending review) so it asks for confirmation first.
 */
export function KycAction({
  investorId,
  status,
}: {
  investorId: string;
  status: "pending" | "approved" | "rejected";
}) {
  const [open, setOpen] = useState(false);
  const next = status === "approved" ? "pending" : "approved";
  const label = status === "approved" ? "Reset" : "Approve";

  // Reset (approved → pending) is destructive: confirm before submitting.
  if (status === "approved") {
    return (
      <>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setOpen(true)}
        >
          {label}
        </Button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Reset KYC status?"
          description="This will return the investor to pending KYC review. They may need manual follow-up before investing again."
          confirmLabel="Reset KYC"
          confirmVariant="danger"
          onConfirm={async () => {
            const fd = new FormData();
            fd.set("investorId", investorId);
            fd.set("status", next);
            await setInvestorKyc(fd);
          }}
        />
      </>
    );
  }

  return (
    <form action={setInvestorKyc} className="inline">
      <input type="hidden" name="investorId" value={investorId} />
      <input type="hidden" name="status" value={next} />
      <Button type="submit" variant="secondary" size="sm">
        {label}
      </Button>
    </form>
  );
}
