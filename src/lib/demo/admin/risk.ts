import type {
  RiskFrameworkData,
  RiskDimension,
  RiskDimensionId,
  RiskBand,
  RiskSeverity,
  RiskStatus,
} from "@/lib/data/risk-framework";

// ---------------------------------------------------------------------------
// Demo builder — admin risk framework (simulated data, no DB / no engine I/O).
//
// Scores are chosen to paint a healthy-but-not-perfect picture:
//   composite 38 → band "low", label "Low–Moderate"
//   Most dimensions green; smart_contract slightly amber (pre-audit realism).
// ---------------------------------------------------------------------------

interface DimSpec {
  id: RiskDimensionId;
  label: string;
  score: number;
  severity: RiskSeverity;
  status: RiskStatus;
  detail: string;
}

const DEMO_DIMENSIONS: DimSpec[] = [
  {
    id: "smart_contract",
    label: "Smart Contract",
    score: 42,
    severity: "medium",
    status: "MONITORED",
    detail:
      "Audited contracts with < 6 months production exposure; Spearbit audit before Phase 3.",
  },
  {
    id: "mining",
    label: "Mining Operations",
    score: 22,
    severity: "low",
    status: "STABLE",
    detail:
      "Margin score 64/100 — fleet economics comfortably above target.",
  },
  {
    id: "counterparty",
    label: "Counterparty",
    score: 18,
    severity: "low",
    status: "OPTIMAL",
    detail:
      "Fully diversified mining + custody set with redundant attestations.",
  },
  {
    id: "market",
    label: "Market",
    score: 35,
    severity: "low",
    status: "STABLE",
    detail:
      "BTC vol index 48/100; market regime supportive of full exposure.",
  },
  {
    id: "liquidity",
    label: "Liquidity",
    score: 28,
    severity: "low",
    status: "HEALTHY",
    detail:
      "Liquid stables cover modelled redemption demand with buffer.",
  },
];

const DEMO_COMPOSITE = 38;
const DEMO_BAND: RiskBand = "low";
const DEMO_BAND_LABEL = "Low–Moderate";

export function buildDemoRiskFramework(): RiskFrameworkData {
  const dimensions: RiskDimension[] = DEMO_DIMENSIONS.map((d) => ({
    id: d.id,
    label: d.label,
    score: d.score,
    severity: d.severity,
    status: d.status,
    detail: d.detail,
  }));

  return {
    composite: DEMO_COMPOSITE,
    band: DEMO_BAND,
    bandLabel: DEMO_BAND_LABEL,
    dimensions,
    source: "db",
  };
}
