/**
 * Catalyst Stepper — canonical numbered vertical rail (process / capital route).
 *
 * TWO Series1 surfaces hand-rolled the exact same idiom: a zero-padded numbered
 * node column ("01", "02", …) joined by a hairline spine, with a title/detail
 * column. Series1Timeline (reserve construction path) and Series1CapitalFlow
 * (deposit → allocation → reserve → delivery) were byte-for-byte the same tree
 * with two cosmetic presets. This is the extracted primitive both now delegate
 * to — Catalyst becomes the single authority for the idiom, render unchanged.
 *
 * This is DELIBERATELY distinct from `StepTimeline` (catalyst/step-timeline.tsx),
 * which renders ROUND `rounded-full` nodes with un-padded numbers on `--ct-space-8`
 * sizing — a different visual used by the Capital-Protection explainers. Folding
 * Series1 onto StepTimeline would move pixels (square vs round node, "1" vs "01",
 * size-7 vs space-8), so the render-stable convergence keeps the two idioms as two
 * primitives rather than one lossy merge.
 *
 * Server component, pure render, token-only (`--ct-*`), one accent, dark-mode only.
 * No motion, no state.
 *
 * `size` is the only cosmetic preset (the two callers differed by exactly this):
 *   - "sm":  node number `text-xs`, title `text-sm`, detail `text-xs`/muted,
 *            quiet node fill `--ct-status-neutral-soft`, quiet node `rounded-(--ct-radius-sm)`.
 *   - "xs":  node number `text-nano`, title `text-2xs`, detail `text-nano`/faint,
 *            quiet node fill a deep color-mix, quiet node `rounded-md`.
 * Each item's `active` flag selects the accent (ring) node vs the quiet node.
 */

import { cn } from "@/lib/cn";

export interface StepperItem {
  label: string;
  detail?: React.ReactNode;
  /** Accent (ringed) node when true, quiet fill when false. */
  active?: boolean;
}

export interface StepperProps {
  steps: readonly StepperItem[];
  /** Cosmetic preset — see file header. Default `sm`. */
  size?: "sm" | "xs";
  /** Extra classes on the outer <ol> (padding, flex-1, list-none, m-0…). */
  className?: string;
}

const NODE_NUMBER_TEXT: Record<NonNullable<StepperProps["size"]>, string> = {
  sm: "text-xs",
  xs: "text-[length:var(--ct-text-nano)]",
};
const TITLE_TEXT: Record<NonNullable<StepperProps["size"]>, string> = {
  sm: "text-sm",
  xs: "text-[length:var(--ct-text-2xs)]",
};
const DETAIL_TEXT: Record<NonNullable<StepperProps["size"]>, string> = {
  sm: "mt-0.5 text-xs leading-5 text-[var(--ct-text-muted)]",
  xs: "mt-[var(--ct-space-1)] text-[length:var(--ct-text-nano)] leading-relaxed text-[var(--ct-text-faint)]",
};
// Quiet node — the two presets differ in fill + corner radius only.
const QUIET_NODE: Record<NonNullable<StepperProps["size"]>, string> = {
  sm: "rounded-(--ct-radius-sm) bg-(--ct-status-neutral-soft) text-(--ct-text-muted)",
  xs: "rounded-md bg-[color-mix(in_srgb,var(--ct-bg-deep)_55%,var(--ct-surface-page))] text-[var(--ct-text-muted)]",
};
// Bottom padding of the content column between rows (spine height driver).
const CONTENT_PAD: Record<NonNullable<StepperProps["size"]>, string> = {
  sm: "pb-5",
  xs: "pb-[var(--ct-space-5)]",
};

export function Stepper({ steps, size = "sm", className }: StepperProps) {
  return (
    <ol className={cn("flex flex-col", className)}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const active = step.active ?? false;
        return (
          <li key={step.label} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center font-semibold tabular-nums",
                  NODE_NUMBER_TEXT[size],
                  active
                    ? "rounded-md text-(--ct-accent-strong) ring-1 ring-(--ct-border-accent)"
                    : QUIET_NODE[size],
                )}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              {!isLast ? (
                <span className="my-1 w-px flex-1 bg-(--ct-border-soft)" />
              ) : null}
            </div>
            <div className={isLast ? "pb-0" : CONTENT_PAD[size]}>
              <p className={cn("pt-1 font-medium text-(--ct-text-strong)", TITLE_TEXT[size])}>
                {step.label}
              </p>
              {step.detail ? <p className={DETAIL_TEXT[size]}>{step.detail}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
