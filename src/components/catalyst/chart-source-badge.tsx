/**
 * ChartSourceBadge — provenance / truth-status pill for a chart or data block
 * (HC-CHART-001).
 *
 * Narrowly-named Catalyst chart companion that carries the retired HIS
 * `HcSourceBadge` behaviour verbatim (no visual change): only verified sources
 * (live / oracle / attested) get the accent tone; non-production sources
 * (mock / demo / unaudited) get the WARNING tone so they can never be mistaken
 * for live; everything else stays muted. Distinct from the general
 * `ProvenanceBadge` precisely because it keeps that non-production warning tone,
 * which the reserve cockpit relies on. Token-only.
 */

import type { ChartSourceStatus } from "@/components/catalyst/chart-types";

type Tone = "verified" | "neutral" | "nonprod";

const STATUS_MAP: Record<ChartSourceStatus, { label: string; tone: Tone }> = {
  live: { label: "Live", tone: "verified" },
  oracle: { label: "Oracle", tone: "verified" },
  attested: { label: "Attested", tone: "verified" },
  estimated: { label: "Estimated", tone: "neutral" },
  manual: { label: "Manual", tone: "neutral" },
  configured: { label: "Configured", tone: "neutral" },
  fallback: { label: "Fallback", tone: "neutral" },
  stale: { label: "Stale", tone: "neutral" },
  mixed: { label: "Mixed", tone: "neutral" },
  mock: { label: "Mock", tone: "nonprod" },
  demo: { label: "Demo", tone: "nonprod" },
  unaudited: { label: "Unaudited", tone: "nonprod" },
};

const TONE_STYLE: Record<Tone, { dot: string; fg: string; border: string }> = {
  verified: {
    dot: "var(--ct-accent)",
    fg: "var(--ct-accent-strong)",
    border: "var(--ct-border-accent)",
  },
  neutral: {
    dot: "var(--ct-text-faint)",
    fg: "var(--ct-text-muted)",
    border: "var(--ct-border-soft)",
  },
  nonprod: {
    dot: "var(--ct-status-warning)",
    fg: "var(--ct-status-warning)",
    border: "var(--ct-status-warning-border)",
  },
};

export interface ChartSourceBadgeProps {
  status: ChartSourceStatus;
  /** Render only the colored dot (dense rows); the label moves into `title`. */
  dotOnly?: boolean;
  /** Override the hover tooltip. Defaults to `Source: <label>`. */
  title?: string;
}

export function ChartSourceBadge({ status, dotOnly = false, title }: ChartSourceBadgeProps) {
  const { label, tone } = STATUS_MAP[status];
  const c = TONE_STYLE[tone];
  const tooltip = title ?? `Source: ${label}`;

  return (
    <span
      role="img"
      aria-label={tooltip}
      title={tooltip}
      data-tone={tone}
      className="inline-flex items-center gap-1.5 align-middle"
      style={{
        padding: dotOnly ? 0 : "2px 8px",
        borderRadius: "var(--ct-radius-full)",
        border: dotOnly ? "none" : `1px solid ${c.border}`,
        background: dotOnly ? "transparent" : "var(--ct-surface-inset)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: c.dot,
          boxShadow: `0 0 6px ${c.dot}`,
        }}
      />
      {!dotOnly && (
        <span
          style={{
            fontSize: "var(--ct-text-nano)",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: c.fg,
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
