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
 * Section sub-navigation for the admin area — CANON « section-nav » family.
 *
 * This is NAVIGATION (which page within the current section), a distinct family
 * from filters (pills) and primary actions (buttons). It is rendered at
 * eyebrow-altitude ABOVE the page header, quiet and premium: a small uppercase
 * label group + a tiny accent dot on the active item — NOT browser-style tabs,
 * NO full-width border that would compete with the header's green rule.
 *
 * Sections with ≤1 tab render nothing. Active tab uses the longest matching
 * href so /admin/vaults/[id] still lights up "Overview".
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
    <nav aria-label={`${section.label} sections`} className="section-nav">
      <ul className="section-nav__list">
        {tabs.map((tab) => {
          const isActive = tab.href === activeHref;
          return (
            <li key={tab.id} className="section-nav__item">
              <Link
                href={withAdminVaultQuery(tab.href, vaultScope)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "section-nav__link",
                  isActive && "section-nav__link--active",
                )}
              >
                <span className="section-nav__dot" aria-hidden="true" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
