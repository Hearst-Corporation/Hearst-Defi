// Capital Protection — structural, honest render for the position detail page.
// Server component, pure render (props are pre-computed server-side by the page).
//
// HONESTY CONTRACT: no "protection %" or "recovery rate" is fabricated — none of
// that exists in the data model. This surface only states the REAL structural
// safeguards of the product (qualitative) plus the true USDC amounts. Provenance
// is "manual": these are administrator-stated structural facts, not live metrics.
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { formatUsdFull } from "@/lib/vaults/product-display";
import { cn } from "@/lib/cn";

interface PositionCapitalProtectionProps {
  principalUsdc: number;
  accruedYieldUsdc: number;
  distributedUsdc: number;
  status: "active" | "matured" | "exited";
  softLockupDays: number;
  "aria-label"?: string;
}

interface Safeguard {
  title: string;
  description: string;
}

export function PositionCapitalProtection({
  principalUsdc,
  accruedYieldUsdc,
  distributedUsdc,
  status,
  softLockupDays,
  "aria-label": ariaLabel,
}: PositionCapitalProtectionProps) {
  const lockupCopy =
    softLockupDays > 0
      ? `${softLockupDays}-day soft lock-up on new subscriptions. Redemption requests outside the window are queued, not blocked.`
      : "Open-ended — no fixed soft lock-up window is set on this position.";

  const safeguards: Safeguard[] = [
    {
      title: "Cayman SPV structure",
      description:
        "Capital sits in a segregated Cayman special-purpose vehicle, legally ring-fenced from the manager's balance sheet.",
    },
    {
      title: "Soft lock-up",
      description: lockupCopy,
    },
    {
      title: "Three-pocket reserve",
      description:
        "The deployed base is allocated across Mining Power, BTC Pouch and Reserve USDC under the Series 1 policy.",
    },
    {
      title: "Recovery mechanism",
      description:
        "At maturity, the contractual waterfall applies the documented settlement order. Ordering is deterministic; outcomes remain conditional.",
    },
  ];

  // Capital-at-work bar: base = principal, accent overlay = recorded value change.
  // Purely proportional to the two real USDC figures; no invented ratios.
  const base = principalUsdc > 0 ? principalUsdc : 0;
  const accrued = accruedYieldUsdc > 0 ? accruedYieldUsdc : 0;
  const total = base + accrued;
  const accruedPct = total > 0 ? Math.min(100, (accrued / total) * 100) : 0;
  const basePct = 100 - accruedPct;

  const statusCaption =
    status === "active"
      ? "Position is active — capital remains deployed."
      : status === "matured"
        ? "Position has matured — safeguards applied through the term."
        : "Position has exited — capital and proceeds have been settled.";

  return (
    <div className="p-5" aria-label={ariaLabel ?? "Capital protection"}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="ct-metric-caption text-[var(--ct-text-muted)]">
          Structural safeguards on deployed capital
        </p>
        <ProvenanceBadge kind="manual" compact />
      </div>

      {/* Safeguard cards — hairline grid, qualitative structural mechanisms */}
      <div
        className={cn(
          "grid grid-cols-1 gap-px overflow-hidden rounded-2xl sm:grid-cols-2",
          "border border-[var(--ct-border-soft)] bg-[var(--ct-border-soft)]",
        )}
      >
        {safeguards.map((s) => (
          <div
            key={s.title}
            className="flex flex-col gap-1.5 bg-[var(--ct-surface-card)] p-4"
          >
            <span className="ct-bento-label text-[var(--ct-text-secondary)]">
              {s.title}
            </span>
            <p className="ct-metric-caption text-[var(--ct-text-muted)]">
              {s.description}
            </p>
          </div>
        ))}
      </div>

      {/* Capital at work — real USDC amounts + proportional micro-bar (no red) */}
      <div className="mt-4 rounded-2xl border border-[var(--ct-border-soft)] p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <span className="ct-bento-label text-[var(--ct-text-secondary)]">
            Capital at work
          </span>
          <span className="ct-metric-value text-[var(--ct-text-primary)]">
            {formatUsdFull(principalUsdc)}
          </span>
        </div>

        <div
          className="flex h-2 w-full overflow-hidden rounded-lg bg-[var(--ct-border-soft)]"
          role="img"
          aria-label={`Principal deployed ${formatUsdFull(principalUsdc)}, recorded value change ${formatUsdFull(accruedYieldUsdc)}`}
        >
          <div
            className="h-full bg-[var(--ct-text-faint)]"
            style={{ width: `${basePct}%` }}
          />
          <div
            className="h-full bg-[var(--ct-accent)]"
            style={{ width: `${accruedPct}%` }}
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <span className="ct-metric-caption text-[var(--ct-text-muted)]">
            Principal deployed · {formatUsdFull(principalUsdc)}
          </span>
          <span className="ct-metric-caption text-[var(--ct-accent)]">
            Recorded value change · {formatUsdFull(accruedYieldUsdc)}
          </span>
          <span className="ct-metric-caption text-[var(--ct-text-muted)]">
            Distributed · {formatUsdFull(distributedUsdc)}
          </span>
        </div>

        <p className="ct-metric-caption mt-2 text-[var(--ct-text-faint)]">
          {statusCaption}
        </p>
      </div>

      <p className="ct-metric-caption mt-4 text-[var(--ct-text-faint)]">
        Capital protection is best-effort and structural, never guaranteed.
      </p>
    </div>
  );
}
