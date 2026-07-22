// Series1DataState — the ONE place the investor dashboard turns an unresolved
// `Wired<T>` into pixels.
//
// This module exists to fix canon F3. The previous surface printed the motive
// ("Not exposed in legacy mode") as the VALUE of every KPI and as the hint of
// every row: with the v2.1 contract undeployed, the same sentence rendered
// about a dozen times, in the largest type on the page. Honest, unreadable.
//
// The dosage rule (canon §5):
//   - the value slot stays visibly EMPTY (an em dash) — never a fabricated
//     zero, never the motive in display type;
//   - the motive is stated ONCE per group, at group level, at the smallest
//     text tier;
//   - a group whose reads all share one motive says it once.
//
// The reason vocabulary itself is unchanged — it is re-exported from
// Series1Wired, which the canon marks KEEP DATA ONLY.

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { reasonLabel, type Series1Wired } from "@/components/series1-shell/Series1Wired";

export type { Series1Wired };
export { reasonLabel };

/**
 * What a cell shows when its read did not resolve. Never a zero.
 *
 * A bare em dash was the first choice, and it read as a broken band: a row of
 * lone hyphens where figures should be says "this UI is missing something",
 * not "this value has not been reported". Two words state the same fact and
 * stay legible at the label tier the muted cells render at.
 */
export const EMPTY_VALUE = "Not reported";

/**
 * Render a wired read's value, or the empty slot. `render` only runs on the
 * `wired` branch, so a caller can never format an absent value into a
 * plausible-looking figure.
 */
export function wiredValue<T>(
  read: Series1Wired<T>,
  render: (data: T) => ReactNode,
): ReactNode {
  return read.status === "wired" ? render(read.data) : EMPTY_VALUE;
}

/** True when the read did not resolve — drives the muted value styling. */
export function isUnresolved(read: Series1Wired<unknown>): boolean {
  return read.status !== "wired";
}

/**
 * Collapse several reads into the single motive a group should state.
 * Returns null when everything resolved (nothing to say), the shared motive
 * when they all failed the same way, or a generic line when they diverge —
 * never a list of a dozen repetitions.
 */
export function groupMotive(reads: readonly Series1Wired<unknown>[]): string | null {
  const reasons = reads
    .filter((r): r is Extract<Series1Wired<unknown>, { status: "unavailable" }> =>
      r.status === "unavailable",
    )
    .map((r) => r.reason);

  if (reasons.length === 0) return null;

  const unique = Array.from(new Set(reasons));
  if (unique.length === 1) return reasonLabel(unique[0] as string);
  return "Some readings are unavailable";
}

/**
 * The compact, group-level motive line. One per card or per band — this is the
 * component that replaces ~12 repetitions of the same sentence.
 */
export function Series1DataState({
  motive,
  detail,
  className,
}: {
  /** Already resolved through `groupMotive` / `reasonLabel`. */
  motive: string;
  /** Optional investor-worded context. The adapter's ops vocabulary
   *  (env vars, deploy steps) never reaches this surface. */
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <p
      role="status"
      className={cn("m-0 leading-relaxed text-[var(--ct-text-faint)]", className)}
      style={{ fontSize: "var(--ct-text-nano)" }}
    >
      <span className="font-semibold text-[var(--ct-text-muted)]">{motive}</span>
      {detail ? <> · {detail}</> : null}
    </p>
  );
}

/**
 * Provenance line for a resolved read: which contract answered, and when.
 * On an unresolved read it says nothing — the group motive already did.
 *
 * The dot only renders here, on a genuinely resolved read — it signals "this
 * is live," never a decorative default on an empty/unresolved state.
 */
export function Series1Provenance({ read }: { read: Series1Wired<unknown> }) {
  if (read.status !== "wired") return null;
  const label = read.source === "v2" ? "PermissionedDynaVault v2.1" : "Legacy vault";
  return (
    <span
      className="inline-flex items-center gap-[var(--ct-space-2)] text-[var(--ct-text-faint)]"
      style={{ fontSize: "var(--ct-text-nano)" }}
    >
      <span aria-hidden className="inline-block size-1 shrink-0 rounded-full bg-[var(--ct-s1ds-accent)]" />
      {label} · read {new Date(read.readAt).toISOString().slice(11, 16)} UTC
    </span>
  );
}
