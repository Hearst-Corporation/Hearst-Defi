"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { setAgentTemplateArchived } from "@/app/admin/agents/actions";
import { BENTO_SECONDARY_BTN } from "@/components/catalyst/bento";

/** Toggles a template's archived flag (soft retire / restore). */
export function ArchiveTemplateButton({
  id,
  archived,
}: {
  id: string;
  archived: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", id);
        fd.set("archived", String(!archived));
        await setAgentTemplateArchived(fd);
        toast.success(!archived ? "Archived" : "Restored");
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Failed: ${message}`);
      }
    });
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={onClick}
      className={BENTO_SECONDARY_BTN}
    >
      {archived ? "Restore" : "Archive"}
    </button>
  );
}
