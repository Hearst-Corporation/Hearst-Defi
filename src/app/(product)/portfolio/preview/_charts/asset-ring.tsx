/**
 * AssetRing — thin wrapper around `HcCompositionRing` for per-asset brand hues.
 *
 * Each segment carries its own `color` (from `_data/brand.ts`). The shared primitive
 * handles the DS arc convention, segment gaps, and crisp HTML center labels.
 * Kept as a named export so `portfolio/page.tsx` import sites stay stable.
 */
import {
  HcCompositionRing,
  type HcCompositionSegment,
} from "@/components/dataviz/his/HcCompositionRing";

export type AssetRingSegment = HcCompositionSegment & { color: string };

export function AssetRing({
  segments,
  centerLabel,
  centerValue,
  size = 168,
  thickness = 22,
  ...rest
}: {
  segments: readonly AssetRingSegment[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
  thickness?: number;
  "aria-label": string;
}) {
  return (
    <HcCompositionRing
      segments={segments}
      size={size}
      thickness={thickness}
      segmentGap={6}
      centerHtml
      responsive
      showLegend={false}
      centerLabel={centerLabel}
      centerValue={centerValue}
      aria-label={rest["aria-label"]}
    />
  );
}
