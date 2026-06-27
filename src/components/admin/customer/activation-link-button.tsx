"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { BENTO_SECONDARY_BTN } from "@/components/ui/bento";
import { cn } from "@/lib/cn";
import { generateActivationLink } from "@/app/admin/customers/[id]/actions";

// Smaller secondary CTA for inline use (matches the bento secondary chrome at
// the table/list density).
const SECONDARY_SM = cn(
  BENTO_SECONDARY_BTN,
  "px-3 py-1.5 text-[12px]",
);

/**
 * Admin recovery for the welcome-email dead-end: mints a fresh activation link
 * (7-day /reset-password token) for an investor who can't log in (auto-created
 * with an unusable password, welcome email never delivered). Surfaces the link
 * for the admin to copy and deliver manually — sends no email.
 */
export function ActivationLinkButton({ investorId }: { investorId: string }) {
  const [isPending, startTransition] = useTransition();
  const [link, setLink] = useState<string | null>(null);

  function onClick() {
    startTransition(async () => {
      const result = await generateActivationLink(investorId);
      if (result.ok) {
        setLink(result.activationUrl);
        toast.success("Activation link generated (valid 7 days).");
      } else {
        toast.error(`Could not generate link: ${result.error}`);
      }
    });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied to clipboard.");
    } catch {
      toast.error("Copy failed — select and copy the link manually.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className={cn(SECONDARY_SM, "self-start")}
        onClick={onClick}
        disabled={isPending}
      >
        {isPending ? "Generating…" : "Generate activation link"}
      </button>
      {link && (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-[12px] text-zinc-500">
            Share this one-time link so the investor can set a password and log
            in. Valid 7 days.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all font-mono text-[12px] text-zinc-300">{link}</code>
            <button type="button" className={SECONDARY_SM} onClick={copy}>
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
