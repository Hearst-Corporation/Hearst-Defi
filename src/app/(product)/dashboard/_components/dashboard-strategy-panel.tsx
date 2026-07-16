import { Card } from "@/components/catalyst/card";
import { BentoKpiTile } from "@/components/catalyst/bento";
import { Progress } from "@/components/catalyst/progress";
import type { AllocationPocketViewModel } from "@/features/investor-ui/types/dashboard";
import type { MiningViewModel } from "@/features/investor-ui/types";
import { Server, ShieldCheck, Wallet } from "lucide-react";

export function DashboardStrategyPanel({
  pockets,
  mining,
}: {
  pockets: readonly AllocationPocketViewModel[] | null;
  mining: MiningViewModel;
}) {
  const b1 = pockets?.find((p) => p.pocket === "B1");
  const b2 = pockets?.find((p) => p.pocket === "B2");
  const b3 = pockets?.find((p) => p.pocket === "B3");

  return (
    <Card className="w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-5)]">
      <div className="flex items-center justify-between">
        <span className="stat-label ct-text-muted">Strategy composition</span>
        <span className="body-xs ct-text-faint">Capital → BTC Accumulation</span>
      </div>

      <div className="flex flex-col gap-[var(--ct-space-4)]">
        <div className="flex flex-col gap-[var(--ct-space-2)]">
          <div className="flex justify-between items-center w-full">
            <div className="flex flex-col gap-1 items-center flex-1">
              <Server size={18} className="ct-text-muted mb-1" />
              <span className="body-sm font-medium ct-text-strong">{b1?.targetBps != null ? `${(b1.targetBps / 100).toFixed(0)}%` : "—"}</span>
              <span className="text-[length:var(--ct-text-nano)] ct-text-muted">Mining Power</span>
            </div>
            <div className="flex flex-col gap-1 items-center flex-1">
              <Wallet size={18} className="ct-text-muted mb-1" />
              <span className="body-sm font-medium ct-text-strong">{b2?.targetBps != null ? `${(b2.targetBps / 100).toFixed(0)}%` : "—"}</span>
              <span className="text-[length:var(--ct-text-nano)] ct-text-muted">Bitcoin Reserve</span>
            </div>
            <div className="flex flex-col gap-1 items-center flex-1">
              <ShieldCheck size={18} className="ct-text-muted mb-1" />
              <span className="body-sm font-medium ct-text-strong">{b3?.targetBps != null ? `${(b3.targetBps / 100).toFixed(0)}%` : "—"}</span>
              <span className="text-[length:var(--ct-text-nano)] ct-text-muted">Operating Reserve</span>
            </div>
          </div>
          
          <div className="h-1.5 w-full flex overflow-hidden rounded-full ct-surface-2 mt-1 shadow-[var(--ct-shadow-inset)]">
            <div style={{ width: `${b1?.targetBps != null ? b1.targetBps / 100 : 40}%` }} className="bg-[var(--ct-text-strong)] h-full opacity-80" />
            <div style={{ width: `${b2?.targetBps != null ? b2.targetBps / 100 : 27}%` }} className="bg-[var(--ct-accent)] h-full" />
            <div style={{ width: `${b3?.targetBps != null ? b3.targetBps / 100 : 33}%` }} className="bg-[var(--ct-text-muted)] h-full opacity-40" />
          </div>
        </div>
      </div>
      
      <div className="pt-[var(--ct-space-4)] border-t border-[var(--ct-border-soft)] grid grid-cols-2 gap-[var(--ct-space-4)] mt-auto">
        <div className="flex flex-col gap-1">
          <span className="ct-bento-label">Convergence Target</span>
          <span className="text-[length:var(--ct-text-lg)] font-medium tabular">Bitcoin</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="ct-bento-label">Accumulation Status</span>
          <span className="text-[length:var(--ct-text-lg)] font-medium tabular text-[var(--ct-accent)]">
            {mining.mining.value?.fleetActive ? "Active" : "Idle"}
          </span>
        </div>
      </div>
    </Card>
  );
}
