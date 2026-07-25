import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface AdminUrlTab {
  /** Stable identity, compared against `activeKey`. */
  key: string;
  label: ReactNode;
  /** Full target URL — the caller owns query building (searchParam-driven). */
  href: string;
  /**
   * Optional record count, rendered as "(n)" in tabular figures.
   * Provide it only when the number is actually known: an available zero
   * renders as "(0)" — omit the field when the count is unavailable.
   */
  count?: number;
}

/**
 * URL-driven admin filter tabs — Portfolio bento canon.
 * Active tab = accent-green (#A7FB90) chip, inactive = zinc pill with a faint
 * hover wash. Server component: navigation via href, no client state.
 *
 * Focus: the accent focus ring comes from the global `:focus-visible` rule in
 * `src/styles/app.css` (@layer base — `outline-2 outline-offset-2
 * outline-accent`), so every tab link is keyboard-visible without
 * per-component classes.
 */
export function AdminUrlTabFilter({
  tabs,
  activeKey,
  ariaLabel,
  className,
}: {
  tabs: readonly AdminUrlTab[];
  activeKey: string;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "inline-flex items-center rounded-lg border px-3 py-1.5 text-[length:var(--ct-text-2xs)] font-medium tracking-wide transition-colors",
              isActive
                ? "border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[var(--ct-accent)]"
                : "border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] text-[var(--ct-text-muted)] hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_10%,transparent)] hover:text-[var(--ct-text-strong)]",
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 tabular-nums">({tab.count})</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
