"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { BENTO_SECONDARY_BTN } from "@/components/ui/bento";
import { cn } from "@/lib/cn";
import { runSourcing } from "@/app/admin/outreach/actions";

/**
 * Re-runs sourcing for an existing ICP. MOCK in Palier 0 (no Apollo credit) —
 * the toast flags demo leads. Never sends; new leads land tiered for review.
 */
export function SourceMoreButton({ icpId }: { icpId: string }) {
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      try {
        const { sourced, isMock, byTier, skipped } = await runSourcing(icpId);
        toast.success(
          `${isMock ? "Demo sourcing" : "Sourced"}: +${sourced} · A:${byTier.A} B:${byTier.B} C:${byTier.C}`,
          {
            description:
              skipped > 0
                ? `${skipped} duplicate${skipped === 1 ? "" : "s"} skipped.`
                : isMock
                  ? "Demo leads (Apollo not wired yet)."
                  : undefined,
          },
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Sourcing failed: ${message}`);
      }
    });
  }

  return (
    <button
      type="button"
      className={cn(BENTO_SECONDARY_BTN, "shrink-0 px-3 py-1.5 text-[length:var(--ct-text-2xs)]")}
      onClick={onClick}
      disabled={isPending}
    >
      {isPending ? "Sourcing…" : "Source more"}
    </button>
  );
}
