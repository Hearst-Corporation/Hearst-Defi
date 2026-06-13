"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard,
  FlaskConical,
  ShieldCheck,
  FileCheck,
  FileText,
  Settings2,
  Wallet,
  Vault,
  User,
  Users,
  MessageSquare,
  Zap,
  Scale,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/cn";
import type { NavItem, AdminSection } from "./product-nav-items";
import { PRODUCT_NAV, ADMIN_SECTIONS } from "./product-nav-items";

/** Render `false` on the server and on the first client render, then `true`
 * after hydration — so a client-only portal never causes an SSR mismatch
 * without running setState inside an effect. */
const emptySubscribe = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/**
 * Portal target lives on document.body so the rail escapes the
 * ct-panels-row stacking context (z-index:10) that would otherwise
 * paint over our fixed nav even when ct-rail-intra has z-index:1001.
 */
function useBodyPortal() {
  // Create the portal node once via lazy initial state (client-only — guard
  // against SSR where `document` is undefined). The effect only attaches /
  // detaches it from the DOM, so no setState runs inside the effect body
  // (react-hooks/set-state-in-effect) and reading it during render is safe.
  const [container] = useState<HTMLDivElement | null>(() => {
    if (typeof document === "undefined") return null;
    const el = document.createElement("div");
    el.setAttribute("data-portal", "rail-intra");
    return el;
  });

  useEffect(() => {
    if (!container) return;
    document.body.appendChild(container);
    return () => {
      document.body.removeChild(container);
    };
  }, [container]);

  // Gate on hydration, not on `container`: the lazy state already has the node
  // on the first client render, but the SSR pass rendered nothing — so we must
  // also render nothing on the first client render to match, then portal.
  const hydrated = useHydrated();
  return { container, mounted: hydrated && container !== null };
}

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  FlaskConical,
  ShieldCheck,
  FileCheck,
  FileText,
  Settings2,
  Wallet,
  Vault,
  User,
  Users,
  MessageSquare,
  Zap,
  Scale,
  ArrowLeft,
};

// Thin horizontal rule between nav sections.
function RailSeparator() {
  return (
    <hr
      aria-hidden="true"
      className="ct-rail-sep"
    />
  );
}

// External store backing the rail-expanded state. Memory-only — the rail
// always starts collapsed on every page load (no localStorage persistence).
// The toggle changes the in-memory state for the current page session; a hard
// reload resets it.
let railExpandedState = false;
const railListeners = new Set<() => void>();

function readRailExpanded(): boolean {
  return railExpandedState;
}

function writeRailExpanded(next: boolean): void {
  railExpandedState = next;
  railListeners.forEach((cb) => cb());
}

function subscribeRail(cb: () => void): () => void {
  railListeners.add(cb);
  return () => {
    railListeners.delete(cb);
  };
}

/**
 * Collapsible rail state. Always starts collapsed on every page load. The
 * toggle changes the state for the current session only — no persistence.
 * Reflected onto <html data-rail-mode> so the shell's reserved column
 * (.ct-rail-left) widens in lockstep and pushes the content, instead of the
 * rail overlaying it.
 */
function useRailExpanded(): { expanded: boolean; toggle: () => void } {
  const expanded = useSyncExternalStore(subscribeRail, readRailExpanded, () => false);

  useEffect(() => {
    document.documentElement.dataset.railMode = expanded ? "expanded" : "collapsed";
  }, [expanded]);

  const toggle = useCallback(() => {
    writeRailExpanded(!readRailExpanded());
  }, []);

  return { expanded, toggle };
}

function RailToggle({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = expanded ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
      aria-expanded={expanded}
      title={expanded ? "Collapse" : "Expand"}
      className="ct-rail-toggle"
    >
      <Icon size={16} strokeWidth={2} />
    </button>
  );
}

interface RailItemProps {
  item: NavItem;
  pathname: string;
  /** Override the path-based active check (e.g. a section active on any of its
   *  sibling pages, not just its own href). */
  active?: boolean;
  iconSize?: number;
}

function RailItem({ item, pathname, active, iconSize = 26 }: RailItemProps) {
  const Icon = ICON_MAP[item.icon];
  const isActive =
    active ?? (pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={isActive ? "page" : undefined}
      title={item.label}
      className={cn("ct-rail-item", isActive && "ct-rail-item-active")}
    >
      {Icon ? <Icon size={iconSize} strokeWidth={1.8} /> : null}
      <span className="ct-rail-item-tooltip">{item.label}</span>
    </Link>
  );
}

/** A section's rail item is active on any of its pages (its href or any tab). */
function isSectionActive(section: AdminSection, pathname: string): boolean {
  const hrefs = [section.href, ...section.tabs.map((t) => t.href)];
  return hrefs.some((h) => pathname === h || pathname.startsWith(`${h}/`));
}

/**
 * Full investor rail — Portfolio / Vaults / Profile.
 * When `isAdmin` is true, a separator + "Admin" entry are appended so an admin
 * reviewing the product surfaces can jump back to their zone.
 * Portals to document.body to escape ct-panels-row stacking context.
 */
export function InvestorRailIntra({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const { container, mounted } = useBodyPortal();
  const { expanded, toggle } = useRailExpanded();

  const adminSection = ADMIN_SECTIONS.find((s) => s.id === "dashboard");
  const adminEntry: NavItem | undefined = adminSection
    ? {
        id: adminSection.id,
        // Label is "Admin" (not the section's own "Dashboard") so an admin
        // reviewing the investor surfaces sees an unambiguous jump-to-admin
        // entry, distinct from any in-zone "Dashboard" concept. Route, id and
        // icon stay derived from the section — only the rail label is overridden.
        label: "Admin",
        href: adminSection.href,
        icon: adminSection.icon,
      }
    : undefined;

  const nav = (
    <nav
      className="ct-rail-intra"
      aria-label="Investor navigation"
      data-testid="investor-rail-intra"
      data-rail="investor"
    >
      <RailToggle expanded={expanded} onToggle={toggle} />
      {PRODUCT_NAV.map((item) => (
        <RailItem key={item.id} item={item} pathname={pathname} iconSize={20} />
      ))}
      {isAdmin && adminEntry ? (
        <>
          <RailSeparator />
          <RailItem item={adminEntry} pathname={pathname} iconSize={20} />
        </>
      ) : null}
    </nav>
  );

  if (!mounted || !container) return null;
  return createPortal(nav, container);
}

/**
 * Admin/operator rail — Admin + Customers / separator / analyst tools.
 * Watertight: never shown to investors.
 * Portals to document.body to escape ct-panels-row stacking context.
 */
export function AdminRailIntra() {
  const pathname = usePathname();
  const { container, mounted } = useBodyPortal();
  const { expanded, toggle } = useRailExpanded();

  const nav = (
    <nav
      className="ct-rail-intra"
      aria-label="Admin navigation"
      data-testid="admin-rail-intra"
    >
      <RailToggle expanded={expanded} onToggle={toggle} />
      {ADMIN_SECTIONS.map((section) => (
        <RailItem
          key={section.id}
          item={{
            id: section.id,
            label: section.label,
            href: section.href,
            icon: section.icon,
          }}
          pathname={pathname}
          active={isSectionActive(section, pathname)}
        />
      ))}
      <RailSeparator />
      {/* Return to the investor cockpit. Never active (non-admin route). */}
      <RailItem
        item={{
          id: "back-to-app",
          label: "Investor view",
          href: "/portfolio",
          icon: "ArrowLeft",
        }}
        pathname={pathname}
        active={false}
      />
    </nav>
  );

  if (!mounted || !container) return null;
  return createPortal(nav, container);
}
