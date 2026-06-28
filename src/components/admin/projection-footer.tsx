"use client";

import { useMemo } from "react";

import { projectVaultApy, type VaultDraft } from "@/lib/engine/projection";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProjectionFooterProps {
  vaultDraft: VaultDraft;
}

// ---------------------------------------------------------------------------
// ProjectionFooter — sticky live-projection bar
// Recalculates on every vaultDraft change (pure memoised call).
// ---------------------------------------------------------------------------

export function ProjectionFooter({ vaultDraft }: ProjectionFooterProps) {
  const projection = useMemo(() => projectVaultApy(vaultDraft), [vaultDraft]);

  return (
    <div
      className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm"
      aria-label="Live vault projection"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5">
        <span className="ct-bento-label whitespace-nowrap">
          Projected APY range
        </span>

        <span className="whitespace-nowrap text-[length:var(--ct-text-sm)] font-semibold tabular-nums text-[var(--ct-accent)]">
          {projection.apyRangeLabel}
        </span>

        <Separator />

        <span className="whitespace-nowrap text-[length:var(--ct-text-xs)] text-zinc-400">
          Lockup:&nbsp;
          <span className="font-medium text-white">{projection.lockupDays}d</span>
        </span>

        <Separator />

        <span className="whitespace-nowrap text-[length:var(--ct-text-xs)] text-zinc-400">
          M-of-N:&nbsp;
          <span className="font-medium text-white">{projection.quorum}</span>
        </span>

        <span className="flex-1" />

        <p className="m-0 text-right text-[length:var(--ct-text-micro)] text-zinc-500">
          Live estimate — not guaranteed. Final terms after deployment.
        </p>
      </div>
    </div>
  );
}

function Separator() {
  return <span aria-hidden className="h-4 w-px bg-white/10" />;
}
