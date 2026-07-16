// OperationalStatusStrip — strategy health band (mining, reserve, electricity).

import { cn } from "@/lib/cn";

import type { MiningViewModel, BtcViewModel } from "@/features/investor-ui/types";

interface StatusRow {
  label: string;
  status: string;
  live?: boolean;
}

interface OperationalStatusStripProps {
  mining: MiningViewModel;
  btc: BtcViewModel;
  className?: string;
}

export function OperationalStatusStrip({ mining, btc, className }: OperationalStatusStripProps) {
  const m = mining.mining.value;
  const r = btc.reserve.value;

  const rows: StatusRow[] = [
    {
      label: "Mining production",
      status: m?.fleetActive ? "Active" : m ? "Idle" : "—",
      live: m?.fleetActive === true,
    },
    {
      label: "Bitcoin reserve",
      status: r?.reserveBtcSats ? "Accumulating" : "—",
      live: Boolean(r?.reserveBtcSats),
    },
    {
      label: "Operating reserve",
      status: r?.electricityCoveredMonths != null && r.electricityCoveredMonths >= 6 ? "Healthy" : "Monitoring",
    },
    {
      label: "Electricity coverage",
      status: mining.electricity.value?.canPay ? "Current" : "Review",
    },
    {
      label: "Risk controls",
      status: "Active",
      live: true,
    },
  ];

  return (
    <div
      className={cn(
        "iw-surface-primary flex flex-wrap gap-x-[var(--ct-space-5)] gap-y-[var(--ct-space-3)] p-[var(--ct-space-4)]",
        className,
      )}
      role="list"
    >
      {rows.map((row) => (
        <div key={row.label} className="flex min-w-[8rem] flex-col gap-[var(--ct-space-0_5)]" role="listitem">
          <span className="body-xs ct-text-muted">{row.label}</span>
          <span className="flex items-center gap-[var(--ct-space-1)] body-sm font-medium ct-text-strong">
            {row.live ? (
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--ct-accent)]" />
            ) : null}
            {row.status}
          </span>
        </div>
      ))}
    </div>
  );
}
