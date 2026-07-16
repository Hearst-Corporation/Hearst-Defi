// Mining KPI strip — renders the mining-summary + electricity blocks as
// `<Metric>` tiles, each carrying its own `<ProvenanceBadge>` per
// non-negotiable #2 (no naked numbers). Server Component — pure presentation,
// no business logic (formatting only, no math beyond string composition).

import { Metric } from "@/components/catalyst/metric";
import type { Provenance } from "@/components/ui/provenance-badge";
import type {
  ElectricityViewModel,
  MiningSummaryViewModel,
} from "@/features/investor-ui/types/mining";
import type { DataStatus, ResolvedViewModel } from "@/features/investor-ui/types/common";

/** Maps the presentation-layer DataStatus onto the ProvenanceBadge vocabulary
 *  (which does not have 1:1 kinds for every DataStatus — NOT_CONFIGURED /
 *  UNAVAILABLE / ERROR all read as "manual"-chrome neutral flags, distinct
 *  copy lives in the block's own empty-state, not the badge). */
export function statusToProvenance(status: DataStatus): Provenance {
  switch (status) {
    case "LIVE":
      return "live";
    case "STALE":
      return "stale";
    case "PARTIAL":
      return "partial";
    case "FIXTURE":
      return "simulated";
    case "NOT_CONFIGURED":
    case "UNAVAILABLE":
    case "ERROR":
    default:
      return "manual";
  }
}

function formatHashrate(th: string | null): string {
  if (th == null) return "—";
  const n = Number(th);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 1 })} TH/s`;
}

function formatBtcFromSats(sats: string | null): string {
  if (sats == null) return "—";
  const n = Number(sats);
  if (!Number.isFinite(n)) return "—";
  return `${(n / 1e8).toLocaleString("en-US", { maximumFractionDigits: 6 })} BTC`;
}

function formatUsdc(amount: string | null): string {
  if (amount == null) return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatMonth(current: number | null, duration: number | null): string {
  if (current == null || duration == null) return "—";
  return `Month ${current} / ${duration}`;
}

interface MiningKpiStripProps {
  mining: ResolvedViewModel<MiningSummaryViewModel>;
  electricity: ResolvedViewModel<ElectricityViewModel>;
}

export function MiningKpiStrip({ mining, electricity }: MiningKpiStripProps) {
  const miningProvenance = statusToProvenance(mining.status);
  const electricityProvenance = statusToProvenance(electricity.status);
  const m = mining.value;
  const e = electricity.value;

  return (
    <div className="grid grid-cols-1 gap-[var(--ct-space-4)] sm:grid-cols-2 lg:grid-cols-4">
      <Metric
        label="Reported hashrate"
        value={formatHashrate(m?.reportedHashrateTh ?? null)}
        provenance={miningProvenance}
        tooltip="Fleet hashrate as last reported by the mining operator."
      />
      <Metric
        label="BTC produced (cumulative)"
        value={formatBtcFromSats(m?.totalBtcEarnedSats ?? null)}
        provenance={miningProvenance}
        tooltip="Total BTC accumulated across the 24-month term to date — accumulated at maturity, not distributed."
      />
      <Metric
        label="Term progress"
        value={formatMonth(m?.currentMonth ?? null, m?.productDurationMonths ?? null)}
        provenance={miningProvenance}
        tooltip="Current month of the 24-month BTC-accumulation term."
      />
      <Metric
        label="Fleet state"
        value={
          m?.fleetActive == null
            ? "—"
            : m.curtailed
              ? "Curtailed"
              : m.fleetActive
                ? "Active"
                : "Idle"
        }
        provenance={miningProvenance}
        tooltip="Whether the mining fleet is actively producing, curtailed, or idle."
      />
      <Metric
        label="Electricity — monthly cost"
        value={formatUsdc(e?.monthlyCost ?? null)}
        provenance={electricityProvenance}
        tooltip="Electricity cost for the current billing cycle."
      />
      <Metric
        label="Electricity — total paid"
        value={formatUsdc(e?.totalPaid ?? null)}
        provenance={electricityProvenance}
        tooltip="Cumulative electricity cost paid to date."
      />
      <Metric
        label="Payment status"
        value={e?.canPay == null ? "—" : e.canPay ? "Current" : "Awaiting cycle"}
        sublabel={e?.lastPayment ? `Last paid ${new Date(e.lastPayment).toLocaleDateString()}` : undefined}
        provenance={electricityProvenance}
        tooltip="Whether the next electricity payment is currently eligible to be paid."
      />
      <Metric
        label="Vending curve"
        value={m?.vendingCurveBps == null ? "—" : `${(m.vendingCurveBps / 100).toFixed(2)}%`}
        provenance={miningProvenance}
        tooltip="Current basis-point rate of BTC released to the vending curve mechanism."
      />
    </div>
  );
}
