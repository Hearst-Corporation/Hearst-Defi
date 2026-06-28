/**
 * HcSourceBadge — provenance / truth-status pill for any HIS instrument.
 *
 * Honesty invariant: only verified sources (live / oracle / attested) get the
 * accent tone; non-production sources (mock / demo / unaudited) get the warning
 * tone so they can never be mistaken for live. Everything else stays muted.
 */

import type { HcSourceStatus } from "./types";

type Tone = "verified" | "neutral" | "nonprod";

const STATUS_MAP: Record<HcSourceStatus, { label: string; tone: Tone }> = {
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

export interface HcSourceBadgeProps {
  status: HcSourceStatus;
  /** Render only the colored dot (dense rows); the label moves into `title`. */
  dotOnly?: boolean;
  /** Override the hover tooltip. Defaults to `Source: <label>`. */
  title?: string;
}

export function HcSourceBadge({ status, dotOnly = false, title }: HcSourceBadgeProps) {
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
