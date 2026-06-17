import type { Provenance } from "@/components/ui/provenance-badge";
import type { AdminProofStatus } from "@/lib/data/admin-overview";
import { dashboardUsdCompact } from "@/lib/admin/dashboard-formatters";
import type { HeroKpi } from "@/lib/data/cockpit";
import type { DashboardData } from "@/lib/data/dashboard";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";
import { formatAdminMonthDay } from "@/lib/vaults/product-display";

function hashpriceLabel(data: DashboardData): string {
  const hashprice = data.miningOps.hashprice;
  if (!hashprice) return "Hashprice pending";
  return `$${hashprice.usd_per_th_day.toFixed(3)} / TH / day`;
}

function proofSubtitle(proof: AdminProofStatus): string {
  if (proof.lastMiningAttestationAt) {
    return `Last ${formatAdminMonthDay(proof.lastMiningAttestationAt)}`;
  }
  return proof.proofsTotal > 0 ? `${proof.proofsTotal} proofs on file` : "No attestation yet";
}

function proofValue(
  proofFresh: boolean,
  attestationsCount: number,
): string {
  if (proofFresh) return "Current";
  return attestationsCount > 0 ? "Stale" : "Pending";
}

export function buildDashboardHeroKpis(input: {
  capitalUsdc: number;
  capitalProvenance: Provenance;
  vaultName: string;
  headlineApy: { low: number; high: number } | null;
  yieldPosture: string;
  apyProvenance: Provenance;
  risk: RiskFrameworkData;
  riskProvenance: Provenance;
  miningMarginScore: number;
  miningProvenance: Provenance;
  hasLiveKpis: boolean;
  /** True for demo-builder payloads — Risk/Mining values fill, provenance stays "simulated". */
  simulated: boolean;
  proofFresh: boolean;
  proofProvenance: Provenance;
  proof: AdminProofStatus;
  /** Mirrors `cockpit.actionQueue.length` — same source as the Operator queue panel. */
  operatorQueueCount: number;
  data: DashboardData;
}): HeroKpi[] {
  const riskTone =
    input.risk.band === "high" ? "danger" : input.risk.band === "medium" ? "warning" : "success";
  const apyValue =
    input.headlineApy !== null && input.headlineApy.low > 0 && input.headlineApy.high > 0
      ? `${input.headlineApy.low.toFixed(1)}–${input.headlineApy.high.toFixed(1)}%`
      : "—";

  return [
    {
      label: "Capital",
      value: input.capitalUsdc > 0 ? dashboardUsdCompact.format(input.capitalUsdc) : "—",
      sublabel: input.vaultName,
      provenance: input.capitalProvenance,
    },
    {
      label: "APY",
      value: apyValue,
      sublabel: input.yieldPosture,
      provenance: input.apyProvenance,
    },
    {
      label: "Risk",
      value:
        input.risk.composite > 0
          ? `${input.risk.composite}/100`
          : "—",
      sublabel:
        input.risk.composite > 0
          ? input.risk.bandLabel
          : "—",
      provenance: input.riskProvenance,
      alert: riskTone === "danger",
    },
    {
      label: "Mining",
      value:
        input.miningMarginScore > 0
          ? `${input.miningMarginScore}/100`
          : "—",
      sublabel: hashpriceLabel(input.data),
      provenance: input.miningProvenance,
      alert: input.miningMarginScore > 0 && input.miningMarginScore < 15,
    },
    {
      label: "Proof",
      value: proofValue(input.proofFresh, input.proof.attestationsCount),
      sublabel: proofSubtitle(input.proof),
      provenance: input.proofProvenance,
    },
    {
      label: "Operator queue",
      value: String(input.operatorQueueCount),
      sublabel:
        input.operatorQueueCount === 1
          ? "pending operator action"
          : "pending operator actions",
      provenance: "manual",
      accent: input.operatorQueueCount > 0,
    },
  ];
}
