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
    <div className="ct-projection-footer" aria-label="Live vault projection">
      <div className="ct-projection-footer-inner">
        <span className="stat-label ct-text-muted whitespace-nowrap">
          Projected APY range
        </span>

        <span className="body-md font-semibold tabular ct-text-accent whitespace-nowrap">
          {projection.apyRangeLabel}
        </span>

        <Separator />

        <span className="body-sm ct-text-muted whitespace-nowrap">
          Lockup:&nbsp;
          <span className="ct-text-primary font-medium">
            {projection.lockupDays}d
          </span>
        </span>

        <Separator />

        <span className="body-sm ct-text-muted whitespace-nowrap">
          M-of-N:&nbsp;
          <span className="ct-text-primary font-medium">{projection.quorum}</span>
        </span>

        <span className="flex-1" />

        <p className="body-xs ct-text-faint m-0 text-right">
          Live estimate — not guaranteed. Final terms after deployment.
        </p>
      </div>
    </div>
  );
}

function Separator() {
  return <span className="ct-separator-v" aria-hidden />;
}
