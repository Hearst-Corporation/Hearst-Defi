"use client";

import { useState } from "react";

import { Button } from "@/components/catalyst/button";
import { ConfirmDialog } from "@/components/catalyst/confirm-dialog";
import { setInvestorKyc } from "@/app/admin/customers/actions";

const BTN = "ct-bento-label text-[var(--ct-text-muted)] hover:text-[var(--ct-text-strong)] transition-colors cursor-pointer";

export function KycAction({
  investorId,
  status,
}: {
  investorId: string;
  status: "pending" | "approved" | "rejected";
}) {
  const [open, setOpen] = useState(false);
  const next = status === "approved" ? "pending" : "approved";

  if (status === "approved") {
    return (
      <>
        <Button type="button" variant="quiet" className={BTN} onClick={() => setOpen(true)}>
          Reset
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
      <Button type="submit" variant="quiet" className={BTN}>
        Approve
      </Button>
    </form>
  );
}
