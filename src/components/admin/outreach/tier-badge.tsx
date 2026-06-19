"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { overrideTier } from "@/app/admin/outreach/actions";
import {
  TIER_BADGE_VARIANT,
  TIER_LABEL,
  isTier,
  type Tier,
} from "@/lib/outreach/tier";

/**
 * Tier badge for a sourced prospect, with inline override. Click to open a
 * tiny A/B/C picker — operator judgement beats the score (e.g. bump a Cold lead
 * to Prime so the agent never auto-sends it). Manual prospects show "—".
 */
const TIERS: readonly Tier[] = ["A", "B", "C"];

export function TierBadge({
  prospectId,
  tier,
}: {
  prospectId: string;
  tier: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!isTier(tier) && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ct-text-muted body-xs hover:ct-text-strong ct-focus-ring rounded"
        aria-label="Set tier"
      >
        —
      </button>
    );
  }

  function choose(next: Tier) {
    if (next === tier) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      try {
        await overrideTier(prospectId, next);
        toast.success(`Tier set to ${next} — ${TIER_LABEL[next]}`);
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  }

  if (open) {
    return (
      <span
        className="ct-outreach-tier-picker"
        role="group"
        aria-label="Choose tier"
      >
        {TIERS.map((t) => (
          <button
            key={t}
            type="button"
            disabled={isPending}
            onClick={() => choose(t)}
            className="ct-outreach-tier-option ct-focus-ring"
            aria-pressed={t === tier}
          >
            {t}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ct-outreach-tier-option ct-text-muted ct-focus-ring"
          aria-label="Cancel"
        >
          ✕
        </button>
      </span>
    );
  }

  const current = tier as Tier;
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="ct-focus-ring rounded-full"
      title={`Tier ${current} — ${TIER_LABEL[current]} · click to override`}
      aria-label={`Tier ${current}, click to override`}
    >
      <Badge variant={TIER_BADGE_VARIANT[current]}>
        {current} · {TIER_LABEL[current]}
      </Badge>
    </button>
  );
}
