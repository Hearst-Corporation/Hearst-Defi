import type { Provenance } from "@/components/ui/provenance-badge";
import type { AdminProofStatus } from "@/lib/data/admin-overview";
import { dashboardUsdCompact } from "@/lib/admin/dashboard-formatters";
import type { HeroKpi } from "@/lib/data/cockpit";
import type { DashboardData } from "@/lib/data/dashboard";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";
import { formatAdminMonthDay } from "@/lib/vaults/product-display";

function heroProvenance(kind: Provenance): HeroKpi["provenance"] {
  if (kind === "partial" || kind === "simulated") return "estimated";
  return kind;
}

function hashpriceLabel(data: DashboardData, hasLiveKpis: boolean): string {
  if (!hasLiveKpis) return "awaiting snapshot";
  const hashprice = data.miningOps.hashprice;
  if (!hashprice) return "Hashprice pending";
  return `$${hashprice.usd_per_th_day.toFixed(3)} / TH / day`;
}

function proofSubtitle(proof: AdminProofStatus, hasLiveKpis: boolean): string {
  if (!hasLiveKpis && proof.attestationsCount > 0) {
    const date = proof.lastMiningAttestationAt
      ? formatAdminMonthDay(proof.lastMiningAttestationAt)
      : null;
    return date ? `Attestation on file · ${date}` : "Attestation on file";
  }
  if (proof.lastMiningAttestationAt) {
    return `Last ${formatAdminMonthDay(proof.lastMiningAttestationAt)}`;
  }
  return proof.proofsTotal > 0 ? `${proof.proofsTotal} proofs on file` : "No attestation yet";
}

function proofValue(
  hasLiveKpis: boolean,
  proofFresh: boolean,
  attestationsCount: number,
): string {
  if (hasLiveKpis) {
    if (proofFresh) return "Current";
    return attestationsCount > 0 ? "Stale" : "Pending";
  }
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
  totalActionRequired: number;
  data: DashboardData;
}): HeroKpi[] {
  // KPI values fill on genuine live data OR in simulated/demo mode.
  // `hasLiveKpis` alone stays the gate for Live/Attested provenance upstream;
  // here we only decide whether the numeric value renders vs. "—".
  const fillKpis = input.hasLiveKpis || input.simulated;
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
      provenance: heroProvenance(input.capitalProvenance),
    },
    {
      label: "APY",
      value: apyValue,
      sublabel: input.yieldPosture,
      provenance: heroProvenance(input.apyProvenance),
    },
    {
      label: "Risk",
      value:
        fillKpis && input.risk.composite > 0
          ? `${input.risk.composite}/100`
          : "—",
      sublabel:
        fillKpis && input.risk.composite > 0
          ? input.risk.bandLabel
          : "awaiting snapshot",
      provenance: heroProvenance(input.riskProvenance),
      alert: fillKpis && riskTone === "danger",
    },
    {
      label: "Mining",
      value:
        fillKpis && input.miningMarginScore > 0
          ? `${input.miningMarginScore}/100`
          : "—",
      sublabel: hashpriceLabel(input.data, input.hasLiveKpis),
      provenance: heroProvenance(input.miningProvenance),
      alert: fillKpis && input.miningMarginScore > 0 && input.miningMarginScore < 15,
    },
    {
      label: "Proof",
      value: proofValue(input.hasLiveKpis, input.proofFresh, input.proof.attestationsCount),
      sublabel: proofSubtitle(input.proof, input.hasLiveKpis),
      provenance: heroProvenance(input.proofProvenance),
    },
    {
      label: "Admin queues",
      value: String(input.totalActionRequired),
      sublabel:
        input.totalActionRequired === 1
          ? "governance-tracked action"
          : "governance-tracked actions",
      provenance: "manual",
      accent: input.totalActionRequired > 0,
    },
  ];
}
