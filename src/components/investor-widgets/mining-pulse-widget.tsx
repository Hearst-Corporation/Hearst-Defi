// MiningPulseWidget — compact visual mining status with waveform + drill-down.

import Link from "next/link";

import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";

import type { MiningViewModel } from "@/features/investor-ui/types";
import { DataNotConfigured, DataUnavailable } from "@/features/investor-ui/components/states/data-states";

function formatBtcFromSats(sats: string | null | undefined): string | null {
  if (sats == null) return null;
  const n = Number(sats);
  if (!Number.isFinite(n)) return null;
  return `${(n / 1e8).toFixed(6)} BTC`;
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface MiningPulseWidgetProps {
  mining: MiningViewModel;
  className?: string;
}

export function MiningPulseWidget({ mining, className }: MiningPulseWidgetProps) {
  const summary = mining.mining;

  if (summary.status === "NOT_CONFIGURED") {
    return (
      <div className={cn("iw-surface-primary p-[var(--ct-space-5)]", className)}>
        <DataNotConfigured label="Mining pulse" detail="Mining metrics are not indexed on this network yet." />
      </div>
    );
  }

  if (summary.status === "UNAVAILABLE" || summary.status === "ERROR") {
    return (
      <div className={cn("iw-surface-primary p-[var(--ct-space-5)]", className)}>
        <DataUnavailable label="Mining pulse" />
      </div>
    );
  }

  const v = summary.value;
  const active = v?.fleetActive === true;

  return (
    <div className={cn("iw-surface-primary flex flex-col gap-[var(--ct-space-4)] p-[var(--ct-space-5)]", className)}>
      <div className="flex items-center justify-between gap-[var(--ct-space-2)]">
        <span className="stat-label ct-text-muted">Mining pulse</span>
        <Link href="/mining" className="body-xs ct-link-accent whitespace-nowrap">
          Explore mining contribution →
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-[var(--ct-space-5)]">
        <div className="iw-mining-wave" aria-hidden>
          {[40, 65, 45, 80, 55, 70, 50].map((h, i) => (
            <span
              key={i}
              className="iw-mining-wave__bar"
              style={{ height: active ? `${h}%` : "20%", opacity: active ? 1 : 0.4 }}
            />
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-[var(--ct-space-2)]">
          <div className="flex items-center gap-[var(--ct-space-2)]">
            <span
              aria-hidden
              className={`h-2 w-2 rounded-full ${active ? "bg-[var(--ct-accent)]" : "bg-[var(--ct-text-faint)]"}`}
            />
            <span className="body-sm font-medium ct-text-strong">
              {active ? "Mining active" : "Mining idle"}
              {v?.curtailed ? " · curtailed" : ""}
            </span>
            <ProvenanceBadge kind={summary.status === "STALE" ? "stale" : "estimated"} variant="compact" />
          </div>
          <div className="flex flex-wrap gap-x-[var(--ct-space-4)] gap-y-[var(--ct-space-1)] body-xs ct-text-muted">
            <span>
              Hashrate{" "}
              <span className="ct-text-body font-medium tabular">
                {v?.reportedHashrateTh != null ? `${v.reportedHashrateTh} TH/s` : "—"}
              </span>
            </span>
            <span>
              BTC generated{" "}
              <span className="ct-text-body font-medium tabular">{formatBtcFromSats(v?.totalBtcEarnedSats) ?? "—"}</span>
            </span>
            <span>
              Last report <span className="ct-text-body font-medium">{formatDate(v?.lastReportTime) ?? "—"}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
