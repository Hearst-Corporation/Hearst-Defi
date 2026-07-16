/**
 * Catalyst StepTimeline — canonical vertical numbered timeline.
 *
 * The only vertical-timeline idiom in the repo was welded inside the
 * live-streaming `ConstructionStepper`; static surfaces (Capital Protection's
 * Monitoring → Trigger → Recovery, "how it works" explainers) had to hand-roll a
 * spine + numbered nodes each time. This is the extracted primitive: a numbered
 * node column with a continuous connector spine and a title/description column.
 *
 * Server component, pure render, token-only (`--ct-*`), dark-mode only. Tone
 * colours each node's ring; default `accent`. No motion, no state — the animated
 * pipeline stepper stays its own component.
 */

import { cn } from "@/lib/cn";

export type StepTimelineTone = "accent" | "warning" | "danger" | "neutral";

export interface StepTimelineItem {
  title: string;
  description?: React.ReactNode;
  /** Node ring/number colour. Default `accent`. */
  tone?: StepTimelineTone;
}

export interface StepTimelineProps {
  steps: readonly StepTimelineItem[];
  "aria-label": string;
  className?: string;
}

const TONE_NODE: Record<StepTimelineTone, string> = {
  accent: "border-[var(--ct-border-accent)] text-[var(--ct-accent)]",
  warning: "border-[var(--ct-status-warning-border)] text-[var(--ct-status-warning)]",
  danger: "border-[var(--ct-status-danger-border)] text-[var(--ct-status-danger)]",
  neutral: "border-[var(--ct-border-soft)] text-[var(--ct-text-muted)]",
};

export function StepTimeline({ steps, className, ...rest }: StepTimelineProps) {
  const ariaLabel = rest["aria-label"];
  return (
    <ol role="list" aria-label={ariaLabel} className={cn("flex flex-col", className)}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const tone = step.tone ?? "accent";
        return (
          <li key={i} className={cn("relative flex gap-(--ct-space-4)", !isLast && "pb-(--ct-space-6)")}>
            {/* Connector spine — from just below this node to the bottom of the row,
                so it threads into the next node. Sits behind the node (z-0). */}
            {!isLast ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-(--ct-space-8) bottom-0 left-[calc(var(--ct-space-8)/2)] w-px -translate-x-1/2 bg-[var(--ct-border-soft)]"
              />
            ) : null}
            {/* Numbered node */}
            <span
              aria-hidden="true"
              className={cn(
                "relative z-10 flex h-(--ct-space-8) w-(--ct-space-8) shrink-0 items-center justify-center rounded-(--ct-radius-full) border bg-[var(--ct-surface-card)] text-[length:var(--ct-text-xs)] font-semibold",
                TONE_NODE[tone],
              )}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {i + 1}
            </span>
            {/* Content */}
            <div className="flex min-w-0 flex-col gap-(--ct-space-1) pt-(--ct-space-0_5)">
              <span className="body-sm ct-text-strong font-medium">{step.title}</span>
              {step.description !== undefined ? (
                <div className="ct-metric-caption text-[var(--ct-text-muted)]">
                  {step.description}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
