"use client";

import { type ComponentType } from "react";
import { BookMarked, FileText, Landmark, LayoutDashboard, PieChart, ShieldCheck } from "lucide-react";

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

type Series1NavItem = {
  id: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

/**
 * The six investor surfaces (PROMPT 027 target nav): Dashboard · Bitcoin
 * Constitution · Vaults · Portfolio · Proof Center · Profile. Bitcoin Reserve,
 * Mining, Ledger and My Vaults were folded in earlier: their routes redirect
 * (see each route's page.tsx) rather than standing as separate destinations, so
 * the rail carries one entry per real surface instead of a menu of
 * near-duplicates. Admin, webhooks, diagnostics and the folded Portfolio
 * sub-pages (/portfolio/yield, /portfolio/distributions) never appear here.
 *
 * Rendered in two premium sections (product + Records); six items total.
 * Module-local: the arrays are rendered here and nowhere else.
 */
const SERIES1_NAV: Series1NavItem[] = [
  { id: "overview", label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { id: "bitcoin-constitution", label: "Bitcoin Constitution", href: "/bitcoin-constitution", icon: BookMarked },
  { id: "vaults", label: "Series 1 Vault", href: "/vaults", icon: Landmark },
  { id: "portfolio", label: "My Position", href: "/portfolio", icon: PieChart },
];

/** Compliance surfaces — proof and paperwork, grouped away from the product. */
const SERIES1_RECORDS_NAV: Series1NavItem[] = [
  { id: "proof-center", label: "Proof Center", href: "/proof-center", icon: ShieldCheck },
  { id: "documents-kyc", label: "Documents & KYC", href: "/profile", icon: FileText },
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

        <SidebarSection>
          <SidebarHeading>Records</SidebarHeading>
          {SERIES1_RECORDS_NAV.map(renderItem)}
        </SidebarSection>
      </SidebarBody>
    </Sidebar>
  );
}
