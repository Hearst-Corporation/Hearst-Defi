"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ADMIN_SECTIONS } from "@/components/nav/product-nav-items";
import { cn } from "@/lib/cn";

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
export function AdminSubNav() {
  const pathname = usePathname();

  const section = ADMIN_SECTIONS.find(
    (s) => s.tabs.some((t) => matches(pathname, t.href)) || matches(pathname, s.href),
  );

  if (!section) return null;

  // Exclude the root tab (the one whose href matches the section root) — it
  // duplicates the page's own H1 and is reachable via the left rail.
  const visibleTabs = section.tabs.filter((t) => t.href !== section.href);

  if (visibleTabs.length <= 1) return null;

  // Longest matching href wins (so nested routes pick the most specific tab).
  const activeHref = visibleTabs
    .filter((t) => matches(pathname, t.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav
      aria-label={`${section.label} sections`}
      className="mb-6 flex items-center gap-1 border-b border-[var(--ct-border-soft)]"
    >
      {visibleTabs.map((tab) => {
        const isActive = tab.href === activeHref;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative -mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "border-[var(--ct-accent)] ct-text-accent"
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
