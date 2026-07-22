"use client";

import { type ComponentType } from "react";
import { FileText, Landmark, LayoutDashboard, PieChart, ShieldCheck } from "lucide-react";

import {
  Sidebar,
  SidebarBody,
  SidebarHeader,
  SidebarHeading,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
} from "@/components/catalyst/sidebar";
import { matchesNavPath } from "@/components/nav/product-nav-items";

export type Series1NavItem = {
  id: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

/**
 * The five investor surfaces. Bitcoin Reserve, Mining, Ledger and My Vaults
 * were folded in: their routes now redirect (see each route's page.tsx) rather
 * than standing as separate destinations, so the rail carries one entry per
 * real surface instead of a menu of near-duplicates.
 */
export const SERIES1_NAV: Series1NavItem[] = [
  { id: "overview", label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { id: "vaults", label: "Series 1 Vault", href: "/vaults", icon: Landmark },
  { id: "portfolio", label: "My Position", href: "/portfolio", icon: PieChart },
];

/** Compliance surfaces — proof and paperwork, grouped away from the product. */
export const SERIES1_RECORDS_NAV: Series1NavItem[] = [
  { id: "proof-center", label: "Proof Center", href: "/proof-center", icon: ShieldCheck },
  { id: "documents-kyc", label: "Documents & KYC", href: "/profile", icon: FileText },
];

export function Series1Nav({ pathname }: { pathname: string; onNavigate?: () => void }) {
  const renderItem = (item: Series1NavItem) => {
    const Icon = item.icon;
    return (
      <SidebarItem key={item.id} href={item.href} current={matchesNavPath(pathname, item.href)}>
        <Icon data-slot="icon" />
        <SidebarLabel>{item.label}</SidebarLabel>
      </SidebarItem>
    );
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          {/* Monogram: dark plate, accent letter and edge — the accent is a
              signal here, never a filled tile. */}
          <span className="flex size-8 items-center justify-center rounded-lg bg-zinc-800 text-sm font-bold text-[#a7fb90] ring-1 ring-[#a7fb90]/30">
            H
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-950 dark:text-white">Hearst</div>
            <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              Bitcoin Reserve Vault · Series 1
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarBody>
        <SidebarSection>{SERIES1_NAV.map(renderItem)}</SidebarSection>

        <SidebarSection>
          <SidebarHeading>Records</SidebarHeading>
          {SERIES1_RECORDS_NAV.map(renderItem)}
        </SidebarSection>
      </SidebarBody>
    </Sidebar>
  );
}
