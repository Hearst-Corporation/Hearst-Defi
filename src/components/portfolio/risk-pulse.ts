export interface RiskScore {
  dimension:
    | "market"
    | "mining"
    | "liquidity"
    | "smart_contract"
    | "counterparty";
  score: number;
  delta30d: number;
  series30d?: number[];
}

export type CompositeLabel =
  | "Low"
  | "Low–Moderate"
  | "Moderate"
  | "Elevated"
  | "High";

export interface RiskPulseProps {
  scores: RiskScore[];
  composite: number;
  compositeLabel: CompositeLabel | undefined;
  composite30dTrend: "rising" | "stable" | "falling";
  source?: "live" | "stale";
  updatedAt?: Date;
}

export function compositeLabelColor(label: CompositeLabel): string {
  switch (label) {
    case "Low":
      return "ct-status-success";
    case "Low–Moderate":
      return "ct-text-accent";
    case "Moderate":
      return "ct-status-warning";
    case "Elevated":
    case "High":
      return "ct-status-danger";
  }
}

export function trendMeta(delta: number): {
  icon: string;
  colorClass: string;
  ariaLabel: string;
} {
  if (delta > 0) {
    return {
      icon: "▲",
      colorClass: "ct-status-danger",
      ariaLabel: `rising +${delta}`,
    };
  }
  if (delta < 0) {
    return {
      icon: "▼",
      colorClass: "ct-status-success",
      ariaLabel: `falling ${delta}`,
    };
  }
  return {
    icon: "━━",
    colorClass: "ct-text-tertiary",
    ariaLabel: "stable",
  };
}

export function buildSparklinePath(series: number[]): string {
  if (series.length < 2) return "";
  const w = 64;
  const h = 20;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const points = series.map((v, i) => {
    const x = (i / (series.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M ${points.join(" L ")}`;
}
