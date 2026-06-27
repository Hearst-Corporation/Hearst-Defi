"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { setInvestorKyc } from "@/app/admin/customers/actions";
import { cn } from "@/lib/cn";

/** Compact inline bento control — neutral hairline pill, table-cell sized. */
const KYC_BTN =
  "inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed";

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
        <button type="button" className={KYC_BTN} onClick={() => setOpen(true)}>
          {label}
        </button>
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
      <button
        type="submit"
        className={cn(
          KYC_BTN,
          "border-[#A7FB90]/30 bg-[#A7FB90]/10 text-[#A7FB90] hover:bg-[#A7FB90]/20",
        )}
      >
        {label}
      </button>
    </form>
  );
}
