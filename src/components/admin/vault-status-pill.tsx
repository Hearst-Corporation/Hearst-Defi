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

// Bento lifecycle palette — one green (#A7FB90) for the healthy "live" state,
// amber for the in-flight review/paused states, red for closed, neutral zinc for
// draft/deployed. Colours drive both the dot (bg-current) and the label.
const STATUS_TONE: Record<VaultStatus, string> = {
  draft: "text-zinc-400",
  review: "text-amber-300",
  deployed: "text-zinc-300",
  live: "text-[var(--ct-accent)]",
  paused: "text-amber-300",
  closed: "text-red-400",
};

interface VaultStatusPillProps {
  status: string;
  className?: string;
}

/** Vault lifecycle — dot + label, bento palette (no glass pill). */
export function VaultStatusPill({ status, className }: VaultStatusPillProps) {
  const key = status as VaultStatus;
  const config = STATUS_MAP[key] ?? { label: status };
  const tone = STATUS_TONE[key] ?? "text-zinc-400";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium",
        tone,
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
}
