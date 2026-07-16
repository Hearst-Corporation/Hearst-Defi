import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import type { MiningViewModel, BtcViewModel } from "@/features/investor-ui/types";
import { Activity, Zap } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/catalyst/progress";

export function DashboardHealthPanel({
  mining,
  btc,
}: {
  mining: MiningViewModel;
  btc: BtcViewModel;
}) {
  const m = mining.mining.value;
  const active = m?.fleetActive === true;
  
  const r = btc.reserve.value;
  const monthsCovered = r?.electricityCoveredMonths ?? 0;
  const isHealthy = monthsCovered >= 6;

  return (
    <Card className="w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-5)]">
      <div className="flex flex-col gap-[var(--ct-space-4)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[var(--ct-space-2)]">
            <Activity size={16} className="ct-text-muted" />
            <span className="stat-label ct-text-muted">Mining pulse</span>
          </div>
          <ProvenanceBadge kind={mining.mining.status === "STALE" ? "stale" : "estimated"} variant="compact" />
        </div>
        
        <div className="grid grid-cols-2 gap-[var(--ct-space-3)]">
          <div className="flex flex-col gap-1">
            <span className="ct-bento-label">Network Hashrate</span>
            <span className="text-[length:var(--ct-text-lg)] font-medium tabular">
              {m?.reportedHashrateTh != null ? `${m.reportedHashrateTh} TH/s` : "—"}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="ct-bento-label">Status</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[var(--ct-status-success)]" : "bg-[var(--ct-text-faint)]"}`} />
              <span className="body-sm font-medium">{active ? "Active" : "Idle"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-[var(--ct-space-4)] pt-[var(--ct-space-4)] border-t border-[var(--ct-border-soft)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[var(--ct-space-2)]">
            <Zap size={16} className="ct-text-muted" />
            <span className="stat-label ct-text-muted">Reserve health</span>
          </div>
          <ProvenanceBadge kind={btc.reserve.status === "STALE" ? "stale" : "estimated"} variant="compact" />
        </div>

        <div className="flex flex-col gap-[var(--ct-space-2)]">
          <div className="flex justify-between items-center body-xs">
            <span className="ct-text-muted">Electricity coverage</span>
            <span className="ct-text-strong font-medium">{monthsCovered} months runway</span>
          </div>
          <Progress 
            value={Math.min((monthsCovered / 24) * 100, 100)} 
            max={100} 
            label="Electricity coverage runway"
            fillClassName={isHealthy ? "bg-[var(--ct-status-success)]" : "bg-[var(--ct-status-warning)]"}
          />
        </div>
      </div>
      
      <div className="mt-auto pt-[var(--ct-space-4)] border-t border-[var(--ct-border-soft)]">
        <Link href="/mining" className="body-xs ct-link-accent">
          Explore mining contribution →
        </Link>
      </div>
    </Card>
  );
}
