import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface AdminUrlTab {
  key: string;
  label: ReactNode;
  href: string;
}

/**
 * URL-driven admin filter tabs — Portfolio bento canon.
 * Active tab = accent-green (#A7FB90) chip, inactive = zinc pill with a faint
 * hover wash. Server component: navigation via href, no client state.
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
              "inline-flex items-center rounded-lg border px-3 py-1.5 text-[12px] font-medium tracking-wide transition-colors",
              isActive
                ? "border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[var(--ct-accent)]"
                : "border-[var(--ct-border)] bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
