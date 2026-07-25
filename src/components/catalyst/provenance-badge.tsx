// Specialized provenance chip — delegates its chrome to the canonical Catalyst
// BentoBadge (imported directly, not via the ui/badge compat shim). Token-only.
// Kinds, labels and descriptions come from the SHARED canonical vocabulary
// (src/lib/provenance.ts) — this file owns only the chrome.
import { BentoBadge as Badge } from "@/components/catalyst/bento-badge";
import { Tooltip } from "@/components/catalyst/tooltip";
import { cn } from "@/lib/cn";
import {
  PROVENANCE_DESCRIPTIONS,
  PROVENANCE_LABELS,
  type Provenance,
} from "@/lib/provenance";

export type { Provenance };

const labels: Record<Provenance, string> = PROVENANCE_LABELS;

const descriptions: Record<Provenance, string> = PROVENANCE_DESCRIPTIONS;

// "simulated" is a sandbox marker, NOT an alarm. It renders with the same
// neutral "default" chrome as estimated/manual (a quiet dot + label), never an
// alarm colour — demo data is benign, just not real. The value union is
// deliberately narrower than BentoBadge's: red on a provenance is forbidden
// by doctrine (locked by src/ui/__tests__/provenance-contract.test.ts).
const variants: Record<Provenance, "success" | "brand" | "default" | "flat"> = {
  live: "success",
  oracle: "brand",
  attested: "brand",
  estimated: "flat",
  partial: "flat",
  manual: "flat",
  stale: "flat",
  simulated: "flat",
};

const stripDotTone: Record<Provenance, string> = {
  live: "text-[var(--ct-accent)]",
  oracle: "text-[var(--ct-text-strong)]",
  attested: "text-[var(--ct-text-strong)]",
  estimated: "text-[var(--ct-text-muted)]",
  partial: "text-[var(--ct-text-muted)]",
  manual: "text-[var(--ct-text-body)]",
  stale: "text-[var(--ct-text-muted)] opacity-[var(--ct-opacity-70)]",
  simulated: "text-[var(--ct-text-muted)]",
};

const compactDotTone: Record<Provenance, string> = stripDotTone;

export type ProvenanceBadgeVariant = "default" | "compact" | "strip";

interface ProvenanceBadgeProps {
  kind: Provenance;
  /** Dot-only pill for dense admin KPI rows — full label stays in tooltip + aria-label. */
  compact?: boolean;
  /** `strip` — dot only on black hero KPI strip (no glass pill). */
  variant?: ProvenanceBadgeVariant;
  /**
   * Override the tooltip text. Use when the same badge KIND applies but the
   * default description would misstate the figure — e.g. an "estimated" pocket
   * split is a DETERMINISTIC derivation of the deposit, not a "projection based
   * on historical performance". Keeps the chrome/label, corrects the nature.
   */
  description?: string;
}

export function ProvenanceBadge({
  kind,
  compact = false,
  variant,
  description,
}: ProvenanceBadgeProps) {
  const resolved: ProvenanceBadgeVariant =
    variant ?? (compact ? "compact" : "default");
  const tip = description ?? descriptions[kind];

  if (resolved === "strip") {
    return (
      <Tooltip content={tip}>
        <span
          role="status"
          className={cn("provenance-badge--strip shrink-0", stripDotTone[kind])}
          aria-label={`Data provenance: ${labels[kind]}`}
        >
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current"
          />
          <span className="sr-only">{labels[kind]}</span>
        </span>
      </Tooltip>
    );
  }

  // "stale" repeats on many cards (e.g. an investor with no positions yet) and
  // reads as alarming when stacked. Keep the information, but render it quietly
  // (reduced opacity) so it stops competing with the numbers. All other kinds
  // are unchanged. Opacity floor is 70 (not 60): 0.66 text-muted × 0.60
  // measured 4.3:1 on --ct-bg-deep — below the 4.5 AA floor (caught by the
  // Storybook a11y runner); × 0.70 measures ≥4.5 while keeping the mute.
  const muted = kind === "stale";
  const chromed = resolved !== "compact";

  return (
    <Tooltip content={tip}>
      <Badge
        variant={chromed ? variants[kind] : "flat"}
        role="status"
        aria-label={`Data provenance: ${labels[kind]}`}
        className={
          resolved === "compact"
            ? cn(
                "provenance-badge--compact",
                compactDotTone[kind],
                muted && "opacity-[var(--ct-opacity-70)]",
              )
            : muted
              ? "shrink-0 whitespace-nowrap opacity-[var(--ct-opacity-70)]"
              : "shrink-0 whitespace-nowrap"
        }
      >
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current"
        />
        {/* Label is VISIBLE for both default and compact variants — a bare dot
            leaves provenance legible on hover only, which violates non-negotiable
            #2 (every metric carries a readable provenance badge). The compact
            variant keeps the tighter chrome but now shows its short label. */}
        <span>{labels[kind]}</span>
      </Badge>
    </Tooltip>
  );
}
