"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setAgentTemplateArchived } from "@/app/admin/agents/actions";

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
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Failed: ${message}`);
      }
    });
  }

  return (
    <Button size="sm" variant="ghost" disabled={isPending} onClick={onClick}>
      {archived ? "Restore" : "Archive"}
    </Button>
  );
}
