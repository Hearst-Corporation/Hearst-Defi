/**
 * HcHonestFan — projection fan done honestly, now on the canonical Recharts
 * layer (HC-CHART-001; was pure-SVG on the retired HIS geometry).
 *
 * Graded density: an outer p5–p95 band and an inner, denser p25–p75 band
 * (BoE/Fed). The median p50 is drawn MUTED and dashed — NEVER accent green
 * (green-as-guaranteed is forbidden); reserve accent for realized history only.
 * A graphite band tone keeps the projection from reading as blue/green.
 * Footer stamps the seed + "not guaranteed". Delegates to the tokenised
 * `ChartFan` — no bespoke SVG plotting engine.
 */
"use client";

import { ChartFan } from "@/components/catalyst/chart-fan";

export interface HcHonestBand {
  /** Horizon position (e.g. month index). */
  m: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

export interface HcHonestFanProps {
  bands: readonly HcHonestBand[];
  width?: number;
  height?: number;
  unit?: string;
  seedLabel?: string;
  "aria-label": string;
}

export function HcHonestFan({
  bands,
  height = 180,
  unit = "%",
  seedLabel,
  ...rest
}: HcHonestFanProps) {
  return (
    <ChartFan
      bands={bands}
      height={height}
      unit={unit}
      seedLabel={seedLabel}
      medianTone="muted"
      bandTone="graphite"
      footerNote="not guaranteed"
      aria-label={rest["aria-label"]}
    />
  );
}
