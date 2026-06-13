import { cn } from "@/lib/cn";

type VaultStatus = "draft" | "review" | "deployed" | "live" | "paused" | "closed";

const STATUS_MAP: Record<VaultStatus, { label: string }> = {
  draft: { label: "Draft" },
  review: { label: "Review" },
  deployed: { label: "Deployed" },
  live: { label: "Live" },
  paused: { label: "Paused" },
  closed: { label: "Closed" },
};

const STATUS_TONE: Record<VaultStatus, string> = {
  draft: "ct-text-muted",
  review: "ct-status-warning",
  deployed: "ct-text-strong",
  live: "ct-status-success",
  paused: "ct-status-warning",
  closed: "ct-status-danger",
};

interface VaultStatusPillProps {
  status: string;
  className?: string;
}

/** Vault lifecycle — dot + label, no glass pill (DS PASS B). */
export function VaultStatusPill({ status, className }: VaultStatusPillProps) {
  const key = status as VaultStatus;
  const config = STATUS_MAP[key] ?? { label: status };
  const tone = STATUS_TONE[key] ?? "ct-text-muted";

  return (
    <span
      className={cn("ct-pill", tone, className)}
    >
      <span aria-hidden className="ct-dot bg-current" />
      {config.label}
    </span>
  );
}
