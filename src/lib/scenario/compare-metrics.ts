import type { ScenarioOutput } from "@/lib/engine/types";

export function apyRangeMidpoint(output: ScenarioOutput): number {
  return (output.apy_range.low + output.apy_range.high) / 2;
}

export function computeApyDelta(a: ScenarioOutput, b: ScenarioOutput): number {
  return apyRangeMidpoint(b) - apyRangeMidpoint(a);
}

export function formatSignedFixed(n: number, precision: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "±";
  return `${sign}${Math.abs(n).toFixed(precision)}`;
}

export function formatSignedInt(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "±";
  return `${sign}${Math.abs(Math.round(n))}`;
}

export function deltaToneClass(
  delta: number,
  betterWhenPositive: boolean,
  threshold: number,
): "ct-status-success" | "ct-status-danger" | "ct-text-muted" | "ct-text-body" {
  const isBetter = betterWhenPositive
    ? delta > threshold
    : delta < -threshold;
  const isWorse = betterWhenPositive
    ? delta < -threshold
    : delta > threshold;
  if (isBetter) return "ct-status-success";
  if (isWorse) return "ct-status-danger";
  return "ct-text-muted";
}
