import type { Provenance } from "@/components/ui/provenance-badge";
import type { AdminProofStatus } from "@/lib/data/admin-overview";
import type { HeroKpi } from "@/lib/data/cockpit";
import type { DashboardData } from "@/lib/data/dashboard";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";
import { formatAdminMonthDay } from "@/lib/vaults/product-display";

const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function heroProvenance(kind: Provenance): HeroKpi["provenance"] {
  return kind === "partial" ? "estimated" : kind;
}

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
  proofFresh: boolean;
  proofProvenance: Provenance;
  proof: AdminProofStatus;
  totalActionRequired: number;
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
      value: input.capitalUsdc > 0 ? usdCompact.format(input.capitalUsdc) : "—",
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
        input.hasLiveKpis && input.risk.composite > 0
          ? `${input.risk.composite}/100`
          : "—",
      sublabel:
        input.hasLiveKpis && input.risk.composite > 0
          ? input.risk.bandLabel
          : "awaiting snapshot",
      provenance: heroProvenance(input.riskProvenance),
      alert: riskTone === "danger",
    },
    {
      label: "Mining",
      value:
        input.hasLiveKpis && input.miningMarginScore > 0
          ? `${input.miningMarginScore}/100`
          : "—",
      sublabel: hashpriceLabel(input.data),
      provenance: heroProvenance(input.miningProvenance),
      alert: input.hasLiveKpis && input.miningMarginScore > 0 && input.miningMarginScore < 15,
    },
    {
      label: "Proof",
      value: input.proofFresh ? "Current" : input.proof.attestationsCount > 0 ? "Stale" : "Pending",
      sublabel: proofSubtitle(input.proof),
      provenance: heroProvenance(input.proofProvenance),
    },
    {
      label: "Queues",
      value: String(input.totalActionRequired),
      sublabel: input.totalActionRequired === 1 ? "tracked action" : "tracked actions",
      provenance: "manual",
      alert: input.totalActionRequired > 0,
    },
  ];
}
