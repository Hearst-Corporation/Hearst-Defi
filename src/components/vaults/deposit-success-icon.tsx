import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export function DepositSuccessIcon() {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "inline-flex h-14 w-14 items-center justify-center rounded-full",
        "ct-status-success-bg"
      )}
    >
      <Check className="w-6 h-6" strokeWidth={3} />
    </div>
  );
}
