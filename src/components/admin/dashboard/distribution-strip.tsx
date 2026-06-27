import { cn } from "@/lib/cn";
import { allocationStrokeFor } from "@/lib/allocation-colors";
import type { DashboardAllocation } from "@/lib/data/dashboard";

interface DistributionStripProps {
  allocations: DashboardAllocation[];
  className?: string;
}

export function DistributionStrip({ allocations, className }: DistributionStripProps) {
  const total = allocations.reduce((sum, a) => sum + a.pct, 0);
  if (total <= 0) return null;

  return (
    <div className={cn("flex h-1 w-full overflow-hidden rounded-full bg-white/10", className)}>
      {allocations.map((a) => (
        <div
          key={a.bucket}
          className="h-full transition-all duration-500"
          style={{
            width: `${(a.pct / total) * 100}%`,
            backgroundColor: allocationStrokeFor(a.bucket),
          }}
          title={`${a.bucket}: ${a.pct.toFixed(1)}%`}
        />
      ))}
    </div>
  );
}
