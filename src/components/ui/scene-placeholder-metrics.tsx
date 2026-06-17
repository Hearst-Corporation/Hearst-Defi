import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/skeleton";

const PLACEHOLDER_SLOTS = [
  "APY range",
  "Risk score",
  "PTAI impact",
] as const;

/**
 * Structural empty-state grid for projection / scenario output panels.
 * Skeleton bars only — no fabricated metric values.
 */
export function ScenePlaceholderMetrics({ className }: { className?: string }) {
  return (
    <div
      className={cn("scene-placeholder-metrics", className)}
      aria-hidden="true"
    >
      {PLACEHOLDER_SLOTS.map((label) => (
        <div key={label} className="scene-placeholder-metrics__cell">
          <Skeleton
            className="scene-placeholder-metrics__skeleton--label"
            variant="rect"
          />
          <Skeleton
            className="scene-placeholder-metrics__skeleton--value"
            variant="rect"
          />
          <span className="sr-only">{label}</span>
        </div>
      ))}
    </div>
  );
}
