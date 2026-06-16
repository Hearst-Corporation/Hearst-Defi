"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { ADMIN_SECTIONS } from "@/components/nav/product-nav-items";
import { cn } from "@/lib/cn";
import { withAdminVaultQuery } from "@/lib/vaults/dashboard-scope";

/** Is `pathname` inside `href` (exact or nested route)? */
function matches(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Horizontal sub-navigation for the admin area. Derives the active section from
 * the current path and renders that section's sibling pages as underlined tabs.
 * Sections with ≤1 tab (e.g. Dashboard) render nothing.
 *
 * Active tab uses the longest matching href so /admin/vaults/[id] still lights
 * up "Overview" rather than falling through.
 */
const SECTIONS_WITH_VISIBLE_ROOT_TAB = new Set(["dashboard", "strategy"]);

export function AdminSubNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const vaultScope = searchParams.get("vault");

  const section = ADMIN_SECTIONS.find(
    (s) => s.tabs.some((t) => matches(pathname, t.href)) || matches(pathname, s.href),
  );

  if (!section) return null;

  // Dashboard and Strategy keep their root tab visible so the section landing
  // page has an explicit active state and a stable "back to overview" affordance.
  // Other sections still hide the root tab to avoid duplicating the page H1.
  const visibleTabs = SECTIONS_WITH_VISIBLE_ROOT_TAB.has(section.id)
    ? section.tabs
    : section.tabs.filter((t) => t.href !== section.href);

  if (visibleTabs.length <= 1) return null;

  // Longest matching href wins (so nested routes pick the most specific tab).
  const activeHref = section.tabs
    .filter((t) => matches(pathname, t.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav
      aria-label={`${section.label} sections`}
      className="admin-doc-sub-nav"
    >
      {visibleTabs.map((tab) => {
        const isActive = tab.href === activeHref;
        return (
          <Link
            key={tab.id}
            href={withAdminVaultQuery(tab.href, vaultScope)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative -mb-px border-b-2 px-3 py-2.5 body-sm font-medium transition-colors",
              isActive
                ? "border-(--ct-accent) ct-text-accent"
                : "border-transparent ct-text-muted hover:ct-text-primary",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
