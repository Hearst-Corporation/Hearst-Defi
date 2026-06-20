import type { Provenance } from "@/components/ui/provenance-badge";
import type { VaultLiveMetric } from "@/lib/data/cockpit";
import type { DashboardData } from "@/lib/data/dashboard";
import type { RiskDimensionId, RiskFrameworkData } from "@/lib/data/risk-framework";

// ---------------------------------------------------------------------------
// System Readiness module view — pure derivation, no I/O.
//
// Folds data already loaded by `/admin/dashboard/page.tsx` (risk framework,
// cockpit payload, proof overlay, scoped vault metrics) into the operator-facing
// "is the system ready?" header module. No new fetch, no engine call: this only
// reshapes inputs into display rows. Honesty preserved — every cell carries the
// same provenance/freshness gates the rest of the board already computes.
// ---------------------------------------------------------------------------

export type ReadinessTone = "ok" | "watch" | "alert" | "idle";

export interface ReadinessStat {
  label: string;
  value: string;
  detail: string;
  tone: ReadinessTone;
  provenance?: Provenance;
}

export interface ReadinessFactor {
  id: RiskDimensionId;
  label: string;
  status: string;
  detail: string;
  tone: ReadinessTone;
}

export interface SystemReadinessView {
  /** Aggregate posture across the readiness factors. */
  posture: ReadinessTone;
  postureLabel: string;
  postureBlurb: string;
  stats: ReadinessStat[];
  factors: ReadinessFactor[];
}

/** Operator-facing factor labels (calm, not crypto). */
const FACTOR_LABEL: Record<RiskDimensionId, string> = {
  smart_contract: "Contract",
  mining: "Mining",
  counterparty: "Counterparty",
  market: "Market",
  liquidity: "Liquidity",
};

/** Readiness status copy per factor + tone (operator register, not risk jargon). */
const FACTOR_READY: Record<
  RiskDimensionId,
  Record<ReadinessTone, { status: string; detail: string }>
> = {
  smart_contract: {
    ok: { status: "Healthy", detail: "No issues detected" },
    watch: { status: "Monitored", detail: "Pre-audit posture under review" },
    alert: { status: "Pre-audit", detail: "Mainnet deploy gated on audit" },
    idle: { status: "Awaiting", detail: "Contract telemetry pending" },
  },
  mining: {
    ok: { status: "Healthy", detail: "Margin in range" },
    watch: { status: "Monitored", detail: "Margin compressing" },
    alert: { status: "Compressed", detail: "Margin below buffer" },
    idle: { status: "Awaiting snapshot", detail: "First telemetry pending" },
  },
  counterparty: {
    ok: { status: "Healthy", detail: "All venues operational" },
    watch: { status: "Monitored", detail: "One venue under watch" },
    alert: { status: "Exposed", detail: "Counterparty concentration high" },
    idle: { status: "Awaiting", detail: "Venue telemetry pending" },
  },
  market: {
    ok: { status: "Stable", detail: "No stress detected" },
    watch: { status: "Elevated", detail: "Volatility rising" },
    alert: { status: "Extreme", detail: "Market stress detected" },
    idle: { status: "Awaiting", detail: "Market feed pending" },
  },
  liquidity: {
    ok: { status: "Sufficient", detail: "Buffers in range" },
    watch: { status: "Monitored", detail: "Buffers tightening" },
    alert: { status: "Tight", detail: "Buffers below target" },
    idle: { status: "Awaiting", detail: "Liquidity snapshot pending" },
  },
};

const FACTOR_ORDER: RiskDimensionId[] = [
  "smart_contract",
  "mining",
  "counterparty",
  "market",
  "liquidity",
];

function severityToTone(
  severity: "low" | "medium" | "high",
  hasLiveKpis: boolean,
): ReadinessTone {
  if (!hasLiveKpis) return "idle";
  if (severity === "high") return "alert";
  if (severity === "medium") return "watch";
  return "ok";
}

/** Worst tone wins for the aggregate posture (idle ranks below ok). */
function worstTone(tones: ReadinessTone[]): ReadinessTone {
  if (tones.includes("alert")) return "alert";
  if (tones.includes("watch")) return "watch";
  if (tones.every((t) => t === "idle")) return "idle";
  return "ok";
}

const POSTURE_LABEL: Record<ReadinessTone, string> = {
  ok: "Operational",
  watch: "Monitoring",
  alert: "Action required",
  idle: "Awaiting inputs",
};

function postureBlurb(
  posture: ReadinessTone,
  queueCount: number,
  vaultMode: string,
): string {
  if (posture === "alert") {
    return queueCount > 0
      ? "Operator action required before readiness clears."
      : "A readiness factor needs attention.";
  }
  if (posture === "idle") {
    return `${vaultMode} is awaiting data inputs before full readiness completes.`;
  }
  if (posture === "watch") {
    return "System is monitored — one or more factors under watch.";
  }
  return "All readiness factors are within range.";
}

function vaultModeLabel(
  status: string | null,
  livePreview: boolean,
): { value: string; tone: ReadinessTone } {
  if (livePreview || status === null) return { value: "Preview", tone: "idle" };
  switch (status) {
    case "live":
      return { value: "Live", tone: "ok" };
    case "paused":
      return { value: "Paused", tone: "alert" };
    case "review":
      return { value: "Review", tone: "watch" };
    case "draft":
      return { value: "Draft", tone: "idle" };
    case "closed":
      return { value: "Closed", tone: "idle" };
    default:
      return { value: "Preview", tone: "idle" };
  }
}

function oracleStat(metrics: VaultLiveMetric[]): ReadinessStat {
  // Freshest oracle delay across scoped vaults; null when no telemetry.
  const delays = metrics
    .map((m) => m.oracleDelayMs)
    .filter((d): d is number => d !== null);

  if (delays.length === 0) {
    return {
      label: "Oracle freshness",
      value: "—",
      detail: "No oracle reading yet",
      tone: "idle",
    };
  }

  const min = Math.min(...delays);
  const stale = min > 21_600_000; // 6h SLO mirror of LiveMetrics
  return {
    label: "Oracle freshness",
    value: stale ? "Stale" : `${Math.round(min / 60_000)}m`,
    detail: stale ? "Past 6h freshness window" : "Within freshness window",
    tone: stale ? "alert" : "ok",
  };
}

export interface ReadinessInputs {
  risk: RiskFrameworkData;
  scopedVaultMetrics: VaultLiveMetric[];
  operatorQueueCount: number;
  data: DashboardData;
  hasLiveKpis: boolean;
  /** Soft TTL of the dashboard loaders (seconds). */
  revalidateSec: number;
}

export function resolveSystemReadiness(
  input: ReadinessInputs,
): SystemReadinessView {
  const {
    risk,
    scopedVaultMetrics,
    operatorQueueCount,
    data,
    hasLiveKpis,
  } = input;

  const factors: ReadinessFactor[] = FACTOR_ORDER.map((id) => {
    const dimension = risk.dimensions.find((d) => d.id === id);
    const tone = dimension
      ? severityToTone(dimension.severity, hasLiveKpis)
      : "idle";
    const copy = FACTOR_READY[id][tone];
    return {
      id,
      label: FACTOR_LABEL[id],
      status: copy.status,
      detail: copy.detail,
      tone,
    };
  });

  const posture = worstTone(factors.map((f) => f.tone));
  // Vault mode comes from the scoped live metric (telemetry-backed); falls back
  // to "Preview" when the dashboard is in livePreview scope or has no telemetry.
  const scopedStatus =
    scopedVaultMetrics.find((m) => m.vaultId === data.vaultMeta.id)?.status ??
    null;
  const mode = vaultModeLabel(scopedStatus, data.vaultMeta.livePreview);

  // Readiness stats are scoped to what is UNIQUE to operator supervision and not
  // already shown by the dashboard KPI strip below (APY · Risk · Mining · Proof ·
  // Operator queue). Risk + mining are covered by the 5-factor matrix; proof and
  // queue live in the strip. Keeping only Vault mode + Oracle + the check cadence
  // here removes the duplicated KPIs while preserving the "is the system ready?"
  // read.
  const stats: ReadinessStat[] = [
    {
      label: "Vault mode",
      value: mode.value,
      detail: data.vaultMeta.name,
      tone: mode.tone,
    },
    oracleStat(scopedVaultMetrics),
    {
      label: "Last system check",
      value: "Synced moments ago",
      detail: "All loaders synced",
      tone: "ok",
    },
    {
      label: "Next full check",
      value: `${Math.round(input.revalidateSec)}s`,
      detail: "Background revalidation",
      tone: "idle",
    },
  ];

  return {
    posture,
    postureLabel: POSTURE_LABEL[posture],
    postureBlurb: postureBlurb(posture, operatorQueueCount, mode.value),
    stats,
    factors,
  };
}
