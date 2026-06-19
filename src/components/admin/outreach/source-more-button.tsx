"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={onClick}
      disabled={isPending}
    >
      {isPending ? "Sourcing…" : "Source more"}
    </Button>
  );
}
