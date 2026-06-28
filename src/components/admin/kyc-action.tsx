"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/catalyst/confirm-dialog";
import { setInvestorKyc } from "@/app/admin/customers/actions";
import { cn } from "@/lib/cn";

/** Compact inline control — neutral hairline pill, table-cell sized. Border/text
 *  via DS tokens (no raw white/zinc hardcodes). */
const KYC_BTN =
  "inline-flex items-center justify-center rounded-lg border border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_6%,transparent)] px-2.5 py-1 text-xs font-medium text-[var(--ct-text-body)] transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_12%,transparent)] hover:text-[var(--ct-text-strong)] disabled:opacity-50 disabled:cursor-not-allowed";

/** Accent (approve) tone — single green via the --ct-accent token, NOT #A7FB90. */
const KYC_BTN_ACCENT =
  "border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[var(--ct-accent)] hover:bg-[color-mix(in_srgb,var(--ct-accent)_20%,transparent)] hover:text-[var(--ct-accent)]";

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
      <button type="submit" className={cn(KYC_BTN, KYC_BTN_ACCENT)}>
        {label}
      </button>
    </form>
  );
}
