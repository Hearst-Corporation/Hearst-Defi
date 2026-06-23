"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { generateActivationLink } from "@/app/admin/customers/[id]/actions";

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
    <div className="admin-doc-stack admin-doc-stack--tight">
      <Button
        variant="secondary"
        size="sm"
        onClick={onClick}
        disabled={isPending}
      >
        {isPending ? "Generating…" : "Generate activation link"}
      </Button>
      {link && (
        <div className="admin-doc-stack admin-doc-stack--micro">
          <p className="body-xs ct-text-muted m-0">
            Share this one-time link so the investor can set a password and log
            in. Valid 7 days.
          </p>
          <div className="admin-doc-inline-row admin-doc-inline-row--tight">
            <code className="mono body-xs ct-text-body break-all">{link}</code>
            <Button variant="ghost" size="sm" onClick={copy}>
              Copy
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
