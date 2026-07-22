import { cn } from "@/lib/cn";

import { LINE_CHART_POINTS, MATURITY_TIMELINE } from "../_data/mock";

export function PreviewLineChart({ className }: { className?: string }) {
  const width = 480;
  const height = 160;
  const padding = 16;
  const max = Math.max(...LINE_CHART_POINTS);
  const min = Math.min(...LINE_CHART_POINTS);
  const range = max - min || 1;

  const points = LINE_CHART_POINTS.map((value, index) => {
    const x =
      padding + (index / (LINE_CHART_POINTS.length - 1)) * (width - padding * 2);
    const y =
      height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        role="img"
        aria-label="Preview placeholder line chart"
      >
        <defs>
          <linearGradient id="preview-line-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--shell-accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--shell-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={padding}
            x2={width - padding}
            y1={padding + ratio * (height - padding * 2)}
            y2={padding + ratio * (height - padding * 2)}
            stroke="currentColor"
            strokeOpacity="0.08"
          />
        ))}
        <polygon
          fill="url(#preview-line-fill)"
          points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
        />
        <polyline
          fill="none"
          stroke="var(--shell-accent)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points}
        />
      </svg>
      <p className="absolute bottom-2 right-3 text-[10px] font-medium uppercase tracking-wide text-(--shell-muted)">
        Preview placeholder
      </p>
    </div>
  );
}

export function PreviewAllocationBars({ className }: { className?: string }) {
  const segments = [
    { label: "B1", pct: 40, opacity: "1" },
    { label: "B2", pct: 27, opacity: "0.7" },
    { label: "B3", pct: 33, opacity: "0.4" },
  ];

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex h-4 overflow-hidden rounded-full bg-(--shell-line)">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className="h-full bg-(--shell-accent)"
            style={{ width: `${segment.pct}%`, opacity: segment.opacity }}
            aria-hidden
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {segments.map((segment) => (
          <div key={segment.label} className="rounded-lg border border-(--shell-line) px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-(--shell-muted)">{segment.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-(--shell-text)">{segment.pct}%</p>
          </div>
        ))}
      </div>
      <p className="text-center text-[10px] font-medium uppercase tracking-wide text-(--shell-muted)">
        Preview placeholder
      </p>
    </div>
  );
}

export function PreviewMaturityTimeline({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="relative flex items-start justify-between gap-2">
        <div className="absolute left-4 right-4 top-4 h-px bg-(--shell-line)" aria-hidden />
        {MATURITY_TIMELINE.map((step) => (
          <div key={step.year} className="relative z-10 flex min-w-0 flex-1 flex-col items-center text-center">
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full border text-[10px] font-semibold",
                step.done
                  ? "border-(--shell-accent) bg-(--shell-accent) text-(--shell-accent-ink)"
                  : "border-(--shell-line) bg-(--shell-frame) text-(--shell-muted)",
              )}
            >
              {step.done ? "✓" : "○"}
            </span>
            <p className="mt-2 text-xs font-semibold text-(--shell-text)">{step.year}</p>
            <p className="mt-0.5 text-[10px] leading-4 text-(--shell-muted)">{step.label}</p>
          </div>
        ))}
      </div>
      <p className="text-center text-[10px] font-medium uppercase tracking-wide text-(--shell-muted)">
        Preview placeholder
      </p>
    </div>
  );
}
