"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { BentoBadge as Badge } from "@/components/catalyst/bento-badge";
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
        className="ct-metric-caption rounded transition-colors hover:text-[var(--ct-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ct-border-accent)]"
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
        className="inline-flex items-center gap-1 rounded-lg border border-[var(--ct-border)] bg-surface-inset p-1"
        role="group"
        aria-label="Choose tier"
      >
        {TIERS.map((t) => (
          <button
            key={t}
            type="button"
            disabled={isPending}
            onClick={() => choose(t)}
            className="rounded-md px-2 py-1 text-[length:var(--ct-text-nano)] font-bold text-[var(--ct-text-muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_10%,transparent)] hover:text-[var(--ct-text-strong)] aria-pressed:bg-[var(--ct-accent)] aria-pressed:text-[var(--ct-text-on-accent)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ct-border-accent)]"
            aria-pressed={t === tier}
          >
            {t}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-2 py-1 text-[length:var(--ct-text-nano)] text-[var(--ct-text-muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_10%,transparent)] hover:text-[var(--ct-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ct-border-accent)]"
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
      className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ct-border-accent)]"
      title={`Tier ${current} — ${TIER_LABEL[current]} · click to override`}
      aria-label={`Tier ${current}, click to override`}
    >
      <Badge variant={TIER_BADGE_VARIANT[current]}>
        {current} · {TIER_LABEL[current]}
      </Badge>
    </button>
  );
}
