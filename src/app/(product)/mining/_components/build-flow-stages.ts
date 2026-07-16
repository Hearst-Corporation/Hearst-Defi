// Pure mapping from MiningViewModel → MiningFlowStage[] + its sr-only text
// equivalent. No business logic beyond display formatting (all real math —
// vending curve, curtailment economics — lives in src/lib/engine/*, not
// here); this file only decides what a stage node shows.

import type { MiningFlowStage } from "./mining-flow-canvas";
import type {
  ElectricityViewModel,
  MiningSummaryViewModel,
} from "@/features/investor-ui/types/mining";
import type { ResolvedViewModel } from "@/features/investor-ui/types/common";

function formatHashrateShort(th: string | null): string | null {
  if (th == null) return null;
  const n = Number(th);
  if (!Number.isFinite(n)) return null;
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} TH/s`;
}

function formatBtcShort(sats: string | null): string | null {
  if (sats == null) return null;
  const n = Number(sats);
  if (!Number.isFinite(n)) return null;
  return `${(n / 1e8).toLocaleString("en-US", { maximumFractionDigits: 3 })} BTC`;
}

function formatCoverageMonths(canPay: boolean | null): string | null {
  if (canPay == null) return null;
  return canPay ? "Current" : "Due";
}

export function buildFlowStages(
  mining: ResolvedViewModel<MiningSummaryViewModel>,
  electricity: ResolvedViewModel<ElectricityViewModel>,
): { stages: MiningFlowStage[]; summaryText: string } {
  const m = mining.value;
  const e = electricity.value;
  const configured = mining.status !== "NOT_CONFIGURED" && mining.status !== "UNAVAILABLE";
  const fleetActive = configured ? (m?.fleetActive ?? null) : null;
  const curtailed = configured ? (m?.curtailed ?? false) : false;

  // "active" = the stage has real data flowing through it (drives the dash
  // animation + node emphasis). "isLive" is SEPARATE and strictly gated on
  // `status === "LIVE"` — the accent green is reserved for genuinely live
  // data (never for FIXTURE, even when fixture-active), per the single-green
  // accent rule.
  const active = configured && fleetActive === true && !curtailed;
  const miningIsLive = active && mining.status === "LIVE";
  const electricityIsLive = electricity.status === "LIVE";

  const stages: MiningFlowStage[] = [
    {
      id: "power",
      label: "Mining Power",
      shortLabel: "Power",
      value: configured ? formatHashrateShort(m?.reportedHashrateTh ?? null) : null,
      active,
      isLive: miningIsLive,
    },
    {
      id: "pool",
      label: "Mining Pool",
      shortLabel: "Pool",
      value: null,
      active,
      isLive: miningIsLive,
    },
    {
      id: "production",
      label: "BTC Production",
      shortLabel: "BTC Prod.",
      value: configured ? formatBtcShort(m?.totalBtcEarnedSats ?? null) : null,
      active,
      isLive: miningIsLive,
    },
    {
      id: "reserve",
      label: "Reserve",
      shortLabel: "Reserve",
      value: null,
      active,
      isLive: miningIsLive,
    },
    {
      id: "electricity",
      label: "Electricity Coverage",
      shortLabel: "Electricity",
      value:
        electricity.status !== "NOT_CONFIGURED" && electricity.status !== "UNAVAILABLE"
          ? formatCoverageMonths(e?.canPay ?? null)
          : null,
      active: electricity.status === "LIVE" || electricity.status === "FIXTURE",
      isLive: electricityIsLive,
    },
  ];

  const summaryText = configured
    ? `Mining flow: Mining Power reporting ${formatHashrateShort(m?.reportedHashrateTh ?? null) ?? "no hashrate"}, feeding the pool, producing ${formatBtcShort(m?.totalBtcEarnedSats ?? null) ?? "no BTC yet"} accumulated to date${curtailed ? ", currently curtailed" : ""}, routed to the Reserve, with electricity coverage ${formatCoverageMonths(e?.canPay ?? null) ?? "not available"}.`
    : "Mining flow diagram: data not available — the mining contract is not configured yet.";

  return { stages, summaryText };
}
