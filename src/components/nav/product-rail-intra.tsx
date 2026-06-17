"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  Wallet,
  Vault,
  ArrowLeft,
  Bot,
  ClipboardCheck,
  FileCheck,
  FileText,
  FlaskConical,
  LayoutDashboard,
  LucideIcon,
  MessageSquare,
  Scale,
  Send,
  Settings2,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/cn";
import type { AdminSection, NavItem } from "./product-nav-items";
import {
  ADMIN_JUMP_NAV,
  ADMIN_SECTIONS,
  INVESTOR_VIEW_NAV,
  PRODUCT_NAV,
  adminSectionToNavItem,
  matchesNavPath,
} from "./product-nav-items";

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
  Users,
  MessageSquare,
  Zap,
  Scale,
  Bot,
  ClipboardCheck,
  Send,
  ArrowLeft,
};

const RAIL_ICON_SIZE = 20;

// Thin horizontal rule between nav sections.
function RailSeparator() {
  return (
    <hr
      aria-hidden="true"
      className="ct-rail-sep"
    />
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
  const isActive = active ?? matchesNavPath(pathname, item.href);

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
  return hrefs.some((href) => matchesNavPath(pathname, href));
}

function RailIntraShell({
  ariaLabel,
  testId,
  dataRail,
  children,
}: {
  ariaLabel: string;
  testId: string;
  dataRail?: "investor";
  children: ReactNode;
}) {
  const { container, mounted } = useBodyPortal();

  const nav = (
    <nav
      className="ct-rail-intra"
      aria-label={ariaLabel}
      data-testid={testId}
      {...(dataRail ? { "data-rail": dataRail } : {})}
    >
      <div className="ct-rail-intra__stack">{children}</div>
    </nav>
  );

  if (!mounted || !container) return null;
  return createPortal(nav, container);
}

/**
 * Full investor rail — Portfolio / Vaults / Profile.
 * When `isAdmin` is true, a separator + "Admin" entry are appended so an admin
 * reviewing the product surfaces can jump back to their zone.
 * Portals to document.body to escape ct-panels-row stacking context.
 */
export function InvestorRailIntra({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  return (
    <RailIntraShell
      ariaLabel="Investor navigation"
      testId="investor-rail-intra"
      dataRail="investor"
    >
      {PRODUCT_NAV.map((item) => (
        <RailItem
          key={item.id}
          item={item}
          pathname={pathname}
          iconSize={RAIL_ICON_SIZE}
        />
      ))}
      {isAdmin && ADMIN_JUMP_NAV ? (
        <>
          <RailSeparator />
          <RailItem
            item={ADMIN_JUMP_NAV}
            pathname={pathname}
            iconSize={RAIL_ICON_SIZE}
          />
        </>
      ) : null}
    </RailIntraShell>
  );
}

/**
 * Admin/operator rail — Admin + Customers / separator / analyst tools.
 * Watertight: never shown to investors.
 * Portals to document.body to escape ct-panels-row stacking context.
 */
export function AdminRailIntra() {
  const pathname = usePathname();
  return (
    <RailIntraShell ariaLabel="Admin navigation" testId="admin-rail-intra">
      {ADMIN_SECTIONS.map((section) => (
        <RailItem
          key={section.id}
          item={adminSectionToNavItem(section)}
          pathname={pathname}
          active={isSectionActive(section, pathname)}
          iconSize={RAIL_ICON_SIZE}
        />
      ))}
      {/* Return to the investor cockpit — intentionally invisible, just a tiny dot. */}
      <Link
        href={INVESTOR_VIEW_NAV.href}
        aria-label={INVESTOR_VIEW_NAV.label}
        title={INVESTOR_VIEW_NAV.label}
        className="ct-rail-investor-dot"
      >
        <span />
      </Link>
    </RailIntraShell>
  );
}
