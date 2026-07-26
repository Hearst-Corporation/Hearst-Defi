"use client";

import { useState } from "react";

import { Modal } from "@/components/catalyst/modal";
import { Ptai } from "@/components/catalyst/ptai";
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-[color-mix(in_srgb,var(--hc-fg)_5%,transparent)] px-3 py-1.5 text-2xs font-medium text-foreground hover:bg-[color-mix(in_srgb,var(--hc-fg)_10%,transparent)] transition-colors"
      >
        View PTAI detail
      </button>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={`Rebalance ${event.ruleId} — PTAI detail`}
        className="max-w-2xl"
      >
        <div className="flex flex-col gap-4">
          {/* PTAI — Projection → Trigger → Action → Impact (non-negotiable).
              Rendered inside a nested bento sub-panel; the 4-section structure
              lives in the <Ptai> component and is preserved verbatim. */}
          <div className="rounded-lg bg-surface-inset p-4">
            <Ptai
              variant="flat"
              projection={event.projection || "No projection recorded for this event."}
              trigger={cleanRebalanceTriggerText(event.triggerText)}
              action={event.actionText}
              impact={event.impactText}
            />
          </div>
          <p className="text-2xs text-subtle leading-relaxed">
            Projections shown above are indicative only and not a commitment to
            any specific outcome. Past performance is not a reliable indicator
            of future results.
          </p>
        </div>
      </Modal>
    </>
  );
}
