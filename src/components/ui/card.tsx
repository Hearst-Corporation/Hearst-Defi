/**
 * @deprecated Import from `@/components/catalyst/card` instead.
 * Compatibility shim — CardDescription/CardContent map to catalyst layout slots.
 */
export {
  Card,
  CardHeader,
  CardTitle,
} from "@/components/catalyst/card";

import { cn } from "@/lib/cn";

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("ct-metric-caption ct-text-muted", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-[var(--ct-space-5)]", className)} {...props} />
  );
}
