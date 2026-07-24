"use client";

import { type ComponentType } from "react";
import { LayoutDashboard, Landmark, ShieldCheck, UserRound } from "lucide-react";

import {
  Sidebar,
  SidebarBody,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
} from "@/components/catalyst/sidebar";
import { matchesNavPath } from "@/components/nav/product-nav-items";

type Series1NavItem = {
  id: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

/**
 * The four investor destinations (validated nav doctrine 2026-07-24):
 *   Dashboard · Reserve · Proof · Profile.
 *
 * One flat rail, no sub-sections — each entry is a real place a B2B investor
 * goes, and everything else folds INTO one of them rather than standing alone:
 *   - My Position (/portfolio)      → lives inside Dashboard.
 *   - Documents / KYC / wallet      → live inside Profile.
 *   - Bitcoin Constitution          → lives inside Reserve.
 *   - "Series 1"                     → a subtitle/badge (see SidebarHeader),
 *                                       never a nav label.
 *
 * "Reserve" is the product page — Hearst Bitcoin Reserve — Series 1. It points
 * at /vaults (the existing product surface); the plural "Vaults" wording and
 * the standalone /portfolio, /bitcoin-constitution rail entries are retired.
 * Admin, webhooks and diagnostics never appear here.
 *
 * Module-local: the array is rendered here and nowhere else.
 */
const SERIES1_NAV: Series1NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { id: "reserve", label: "Reserve", href: "/vaults", icon: Landmark },
  { id: "proof", label: "Proof", href: "/proof-center", icon: ShieldCheck },
  { id: "profile", label: "Profile", href: "/profile", icon: UserRound },
];

export function Series1Nav({ pathname }: { pathname: string }) {
  const renderItem = (item: Series1NavItem) => {
    const Icon = item.icon;
    return (
      <SidebarItem
        key={item.id}
        href={item.href}
        current={matchesNavPath(pathname, item.href)}
        className="rounded-(--ct-radius-md) [&&_[data-current=true]]:bg-[color-mix(in_srgb,var(--ct-accent)_8%,transparent)] [&&_[data-current=true]]:text-(--ct-text-strong) [&&_[data-current=true]_*[data-slot=icon]]:fill-(--ct-accent-strong)"
      >
        <Icon data-slot="icon" />
        <SidebarLabel>{item.label}</SidebarLabel>
      </SidebarItem>
    );
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2 py-1.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--ct-surface-raised) text-sm font-bold text-(--ct-accent-strong) ring-1 ring-(--ct-border-accent)">
            H
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-(--ct-text-strong)">
              Hearst
            </div>
            <div className="mt-0.5 truncate text-[10px] font-semibold tracking-[0.12em] text-(--ct-accent-strong) uppercase">
              Series 1
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarBody>
        <SidebarSection>{SERIES1_NAV.map(renderItem)}</SidebarSection>
      </SidebarBody>
    </Sidebar>
  );
}
