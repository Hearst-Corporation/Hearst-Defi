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
        className="rounded text-[12px] text-zinc-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A7FB90]/40"
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
        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-surface-inset p-1"
        role="group"
        aria-label="Choose tier"
      >
        {TIERS.map((t) => (
          <button
            key={t}
            type="button"
            disabled={isPending}
            onClick={() => choose(t)}
            className="rounded-md px-2 py-1 text-[11px] font-bold text-zinc-400 transition-colors hover:bg-white/10 hover:text-white aria-pressed:bg-[#A7FB90] aria-pressed:text-zinc-900 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A7FB90]/40"
            aria-pressed={t === tier}
          >
            {t}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-2 py-1 text-[11px] text-zinc-500 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A7FB90]/40"
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
      className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A7FB90]/40"
      title={`Tier ${current} — ${TIER_LABEL[current]} · click to override`}
      aria-label={`Tier ${current}, click to override`}
    >
      <Badge variant={TIER_BADGE_VARIANT[current]}>
        {current} · {TIER_LABEL[current]}
      </Badge>
    </button>
  );
}
