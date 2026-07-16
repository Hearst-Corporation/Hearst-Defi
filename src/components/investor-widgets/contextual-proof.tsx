// ContextualProof — proof attached to the data it verifies (no global Proof menu).

import Link from "next/link";

import { cn } from "@/lib/cn";

export interface ContextualProofItem {
  readonly label: string;
  readonly lastVerified: string | null;
  readonly href: string;
}

interface ContextualProofProps {
  items: readonly ContextualProofItem[];
  className?: string;
}

export function ContextualProof({ items, className }: ContextualProofProps) {
  if (items.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-[var(--ct-space-3)]", className)}>
      {items.map((item) => (
        <div
          key={item.href}
          className="flex flex-wrap items-center justify-between gap-[var(--ct-space-2)] border-b border-[var(--ct-border-soft)] pb-[var(--ct-space-3)] last:border-0 last:pb-0"
        >
          <div className="flex min-w-0 flex-col gap-[var(--ct-space-0_5)]">
            <span className="body-sm font-medium ct-text-strong">{item.label}</span>
            {item.lastVerified ? (
              <span className="body-xs ct-text-muted">Last verified {item.lastVerified}</span>
            ) : null}
          </div>
          <Link href={item.href} className="body-xs ct-link-accent shrink-0">
            View attestation
          </Link>
        </div>
      ))}
    </div>
  );
}
