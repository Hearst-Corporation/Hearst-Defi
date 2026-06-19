import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface AdminUrlTab {
  key: string;
  label: ReactNode;
  href: string;
}

/**
 * URL-driven admin filter tabs — Link + ct-pill accent (vaults, governance, signals).
 * Server component: navigation via href, no client state.
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
      className={cn("admin-doc-inline-row", className)}
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
            className={cn("ct-pill", isActive && "accent")}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
