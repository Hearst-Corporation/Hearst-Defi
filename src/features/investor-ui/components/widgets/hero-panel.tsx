import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { Progress } from "@/components/catalyst/progress";
import { Bitcoin } from "lucide-react";
import React from "react";

interface HeroMetric {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}

export function HeroPanel({
  title,
  mainValue,
  provenance,
  metrics,
  progress,
  action,
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
}) {
  return (
    <Card className="w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-5)]">
      <div className="flex items-start justify-between gap-[var(--ct-space-4)]">
        <div className="flex flex-col gap-[var(--ct-space-1)]">
          <div className="flex items-center gap-[var(--ct-space-2)]">
            <span className="stat-label ct-text-muted">{title}</span>
            <ProvenanceBadge kind={provenance} variant="compact" />
          </div>
          <span className="text-[length:var(--ct-text-3xl)] font-medium tabular tracking-tight leading-none">
            {mainValue}
          </span>
        </div>
        <div className="flex shrink-0 items-center justify-center w-12 h-12 rounded-full border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] ct-text-strong relative overflow-hidden group">
          <div className="absolute inset-0 bg-[var(--ct-accent)] opacity-10 group-hover:opacity-20 transition-opacity" />
          <Bitcoin size={24} strokeWidth={1.5} className="relative z-10" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-[var(--ct-space-4)] pt-[var(--ct-space-4)] border-t border-[var(--ct-border-soft)]">
        {metrics.map((m, i) => (
          <div key={i} className="flex flex-col gap-1">
            <span className="ct-bento-label truncate">{m.label}</span>
            <span className={`text-[length:var(--ct-text-lg)] font-medium tabular leading-tight ${m.accent ? 'ct-text-accent' : ''}`}>
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
                <span className="ct-text-strong font-medium">{progress.current} / {progress.total}</span>
              </div>
              <Progress value={(progress.current / progress.total) * 100} max={100} label={progress.label} />
            </div>
          )}
          {action && (
            <div className="shrink-0 mt-[var(--ct-space-4)] ml-auto">
              {action}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
