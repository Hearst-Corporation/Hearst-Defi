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
          <Skeleton className="h-3 w-20" variant="text" />
          <Skeleton className="mt-2 h-9 w-full max-w-28" />
          <span className="sr-only">{label}</span>
        </div>
      ))}
    </div>
  );
}
