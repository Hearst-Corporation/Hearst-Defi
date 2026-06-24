"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Ptai } from "@/components/ui/ptai";
import type { ProofCenterRebalanceRow } from "@/lib/data/proof-center";

import { cleanRebalanceTriggerText } from "./formatters";

export function RebalancePtaiModalTrigger({
  event,
}: {
  event: ProofCenterRebalanceRow;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
      >
        View PTAI detail
      </Button>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={`Rebalance ${event.ruleId} — PTAI detail`}
        className="max-w-2xl"
      >
        <div className="product-doc-stack product-doc-stack--relaxed">
          <Ptai
            projection={event.projection || "No projection recorded for this event."}
            trigger={cleanRebalanceTriggerText(event.triggerText)}
            action={event.actionText}
            impact={event.impactText}
          />
          <p className="body-xs ct-text-faint">
            Projections shown above are indicative only and not a commitment to
            any specific outcome. Past performance is not a reliable indicator
            of future results.
          </p>
        </div>
      </Modal>
    </>
  );
}
