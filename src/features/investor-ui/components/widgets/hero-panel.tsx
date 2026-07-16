import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { Progress } from "@/components/catalyst/progress";
import { AssetIcon, type AssetIconVariant } from "@/features/investor-ui/components/asset-icon";
import React from "react";

interface HeroMetric {
  label: string;
  value: React.ReactNode;
  accent?: "btc" | "usdc" | "mining";
}

const ACCENT_CLASS: Record<NonNullable<HeroMetric["accent"]>, string> = {
  btc: "text-[var(--ct-asset-btc)]",
  usdc: "text-[var(--ct-asset-usdc)]",
  mining: "text-[var(--ct-asset-mining)]",
};

export function HeroPanel({
  title,
  mainValue,
  provenance,
  metrics,
  progress,
  action,
  asset = "btc",
}: {
  title: string;
  mainValue: string;
  provenance: Provenance;
  metrics: HeroMetric[];
  progress?: {
    current: number;
    total: number;
    label: string;
  };
  action?: React.ReactNode;
  asset?: AssetIconVariant;
}) {
  return (
    <Card className="w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-5)] border-l-[3px] border-l-[var(--ct-asset-btc-border)]">
      <div className="flex items-start justify-between gap-[var(--ct-space-4)]">
        <div className="flex flex-col gap-[var(--ct-space-1)]">
          <div className="flex items-center gap-[var(--ct-space-2)]">
            <span className="stat-label ct-text-muted">{title}</span>
            <ProvenanceBadge kind={provenance} variant="compact" />
          </div>
          <span className="text-[length:var(--ct-text-3xl)] font-medium tabular tracking-tight leading-none text-[var(--ct-asset-btc)]">
            {mainValue}
          </span>
        </div>
        <div className="flex shrink-0 items-center justify-center w-12 h-12 rounded-full border border-[var(--ct-asset-btc-border)] bg-[var(--ct-asset-btc-soft)]">
          <AssetIcon variant={asset} size="lg" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-[var(--ct-space-4)] pt-[var(--ct-space-4)] border-t border-[var(--ct-border-soft)]">
        {metrics.map((m, i) => (
          <div key={i} className="flex flex-col gap-1">
            <span className="ct-bento-label truncate">{m.label}</span>
            <span
              className={`text-[length:var(--ct-text-lg)] font-medium tabular leading-tight ${
                m.accent ? ACCENT_CLASS[m.accent] : "ct-text-strong"
              }`}
            >
              {m.value}
            </span>
          </div>
        ))}
      </div>

      {(progress || action) && (
        <div className="flex items-center gap-[var(--ct-space-3)] pt-[var(--ct-space-4)] border-t border-[var(--ct-border-soft)]">
          {progress && (
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="flex justify-between items-center body-xs">
                <span className="ct-text-muted">{progress.label}</span>
                <span className="ct-text-strong font-medium">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <Progress value={(progress.current / progress.total) * 100} max={100} label={progress.label} />
            </div>
          )}
          {action && <div className="shrink-0 ml-auto">{action}</div>}
        </div>
      )}
    </Card>
  );
}
