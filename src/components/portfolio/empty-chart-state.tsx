import { EmptySurface } from "@/components/ui/empty-surface";
import { cn } from "@/lib/cn";

export interface EmptyChartStateProps {
  message: string;
  ariaLabel?: string;
  round?: boolean;
  className?: string;
}

export function EmptyChartState({
  message,
  ariaLabel,
  round,
  className,
}: EmptyChartStateProps) {
  return (
    <EmptySurface
      message={message}
      variant="chart"
      round={round}
      ariaLabel={ariaLabel}
      className={cn("relative z-10", className)}
    />
  );
}
