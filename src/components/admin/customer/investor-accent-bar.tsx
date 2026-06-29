import { cn } from "@/lib/cn";
import type { KycStatus } from "@/lib/data/customers";

const BAR_COLOR: Record<KycStatus, string> = {
  pending:  "bg-[var(--ct-status-warning)]",
  approved: "bg-[var(--ct-accent)]",
  rejected: "bg-[var(--ct-status-danger)]",
};

export function InvestorAccentBar({ status = "pending" }: { status?: KycStatus }) {
  return (
    <div
      aria-hidden="true"
      className={cn("h-7 w-1 shrink-0 rounded-full", BAR_COLOR[status])}
    />
  );
}
