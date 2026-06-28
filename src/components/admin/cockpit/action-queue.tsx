import Link from "next/link";

import { cn } from "@/lib/cn";
import type { ActionQueueItem, ActionSeverity } from "@/lib/data/cockpit";

interface ActionQueueProps {
  items: ActionQueueItem[];
}

const ACTION_LABELS: Record<string, string> = {
  "multisig.sign": "Sign multisig",
  "oracle.stale": "Refresh oracle",
  "vault.paused": "Vault paused",
  "distribution.approve": "Approve distribution",
  "kyc.review": "Review KYC",
  "lp.redemption": "Review redemption",
  "rebalance.signal": "Review signal",
  "memo.publish": "Publish memo",
  "mining.margin.red": "Review margin",
  "attestation.overdue": "Review proof",
};

/**
 * Cockpit Admin — Action Queue content (no panel wrapper/header — provided by parent cell).
 *
 * Lists pending operator actions sorted P0 → P1 → P2 with severity dots.
 * Each row has a CTA button linking to the relevant admin page.
 * Graceful empty state when there are no queued items.
 *
 * Bento markup (Portfolio canon) — flat divided rows, semantic danger/warn tones,
 * single accent green reserved for the product accent (never used here).
 */
export function ActionQueue({ items }: ActionQueueProps) {
  if (items.length === 0) {
    return (
      <div
        role="status"
        aria-label="Operator queue"
        className="flex flex-1 items-center justify-center py-8 text-center text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)]"
      >
        All clear — no operator actions queued.
      </div>
    );
  }

  return (
    <ul role="list" aria-label="Operator queue" className="flex flex-col">
      {items.map((item) => (
        <ActionRow key={item.id} item={item} />
      ))}
    </ul>
  );
}

function ActionRow({ item }: { item: ActionQueueItem }) {
  const actionLabel = ACTION_LABELS[item.type] ?? item.type;
  const tone = SEVERITY_TONES[item.severity];

  return (
    <li
      className="flex items-center justify-between gap-3 border-b border-[var(--ct-border-soft)] py-3 transition-colors last:border-b-0 hover:bg-white/[0.02]"
      aria-label={`${item.severity} — ${item.title}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <SeverityDot severity={item.severity} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="block truncate text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-text-body)]">
            {item.title}
          </span>
          <span className="ct-bento-label block truncate">
            {item.context}
          </span>
        </div>
      </div>

      {item.href ? (
        <Link
          href={item.href}
          className={cn(
            "shrink-0 rounded-md border px-2 py-1 text-[length:var(--ct-text-deci)] uppercase tracking-[0.12em] font-bold transition-colors",
            tone.cta,
          )}
          aria-label={`${actionLabel} — ${item.title}`}
        >
          {actionLabel}
        </Link>
      ) : null}
    </li>
  );
}

function SeverityDot({ severity }: { severity: ActionSeverity }) {
  const tone = SEVERITY_TONES[severity];

  return (
    <span
      className="mt-0.5 inline-flex shrink-0 items-center gap-1.5"
      aria-label={`Priority ${severity}`}
    >
      <span className={cn("size-1.5 rounded-full", tone.dot)} aria-hidden />
      <span className={cn("text-[length:var(--ct-text-deci)] font-bold tracking-[0.12em]", tone.text)}>
        {severity}
      </span>
    </span>
  );
}

const SEVERITY_TONES: Record<
  ActionSeverity,
  { dot: string; text: string; cta: string }
> = {
  P0: {
    dot: "bg-red-400",
    text: "text-red-400",
    cta: "border-red-400/20 bg-red-400/10 text-red-400 hover:bg-red-400/20",
  },
  P1: {
    dot: "bg-amber-400",
    text: "text-amber-400",
    cta: "border-amber-400/20 bg-amber-400/10 text-amber-400 hover:bg-amber-400/20",
  },
  P2: {
    dot: "bg-zinc-500",
    text: "text-[var(--ct-text-faint)]",
    cta: "border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] text-[var(--ct-text-muted)] hover:border-[var(--ct-border)] hover:text-[var(--ct-text-body)]",
  },
};
