"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import {
  ADMIN_SECTIONS,
  matchesNavPath,
  visibleSubNavTabs,
} from "@/components/nav/product-nav-items";
import { cn } from "@/lib/cn";
import { withAdminVaultQuery } from "@/lib/vaults/dashboard-scope";

/**
 * Horizontal sub-navigation for the admin area. Derives the active section from
 * the current path and renders that section's sibling pages as underlined tabs.
 * Sections with ≤1 tab render nothing.
 *
 * Active tab uses the longest matching href so /admin/vaults/[id] still lights
 * up "Overview" rather than falling through.
 */
export function AdminSubNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const vaultScope = searchParams.get("vault");

  const section = ADMIN_SECTIONS.find(
    (s) =>
      s.tabs.some((t) => matchesNavPath(pathname, t.href)) ||
      matchesNavPath(pathname, s.href),
  );

  if (!section) return null;

  const tabs = visibleSubNavTabs(section.tabs);
  if (tabs.length <= 1) return null;

  // Longest matching href wins (so nested routes pick the most specific tab).
  const activeHref = tabs
    .filter((t) => matchesNavPath(pathname, t.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav
      aria-label={`${section.label} sections`}
      className="admin-doc-sub-nav"
    >
      {tabs.map((tab) => {
        const isActive = tab.href === activeHref;
        return (
          <Link
            key={tab.id}
            href={withAdminVaultQuery(tab.href, vaultScope)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "admin-doc-sub-nav__link",
              isActive && "admin-doc-sub-nav__link--active",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
