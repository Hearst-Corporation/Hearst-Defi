"use client";

import { usePathname } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";
import {
  BarChart3,
  Bitcoin,
  Bot,
  FileText,
  LayoutDashboard,
  Pickaxe,
  PieChart,
  Settings,
  ShieldCheck,
  Vault,
  X,
} from "lucide-react";

import { Navbar, NavbarSection, NavbarSpacer } from "@/components/catalyst/navbar";
import { SidebarLayout } from "@/components/catalyst/sidebar-layout";
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
} from "@/components/catalyst/sidebar";
import {
  ADMIN_SECTIONS,
  matchesNavPath,
  type NavItem,
} from "@/components/nav/product-nav-items";

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Bitcoin,
  PieChart,
  Vault,
  ShieldCheck,
  Pickaxe,
  FileText,
  Settings,
  Database: BarChart3,
  Workflow: Bot,
};

function AdminSidebar({ pathname }: { pathname: string }) {
  const items: NavItem[] = ADMIN_SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    href: section.href,
    icon: section.icon,
  }));

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <span className="flex size-8 items-center justify-center rounded-lg border border-(--ct-border-accent) bg-zinc-950/5 text-sm font-bold text-zinc-950 dark:bg-white/8 dark:text-white">
            H
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
              Hearst
            </div>
            <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              Bitcoin Reserve Vault · Series 1
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarBody>
        <SidebarSection>
          {items.map((item) => {
            const Icon = iconMap[item.icon] ?? LayoutDashboard;
            return (
              <SidebarItem key={item.id} href={item.href} current={matchesNavPath(pathname, item.href)}>
                <Icon data-slot="icon" />
                <SidebarLabel>{item.label}</SidebarLabel>
              </SidebarItem>
            );
          })}
        </SidebarSection>
      </SidebarBody>

      <SidebarFooter>
        <SidebarSection>
          <SidebarItem href="/dashboard">
            <LayoutDashboard data-slot="icon" />
            <SidebarLabel>Investor view</SidebarLabel>
          </SidebarItem>
        </SidebarSection>
      </SidebarFooter>
    </Sidebar>
  );
}

function AssistantDock({ onClose }: { onClose: () => void }) {
  return (
    <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-zinc-950/10 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-950/8 px-5 py-4 dark:border-white/8">
        <div>
          <p className="text-sm font-semibold text-zinc-950 dark:text-white">Hearst Assistant</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Read-only product guidance</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close assistant"
          className="flex size-10 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-950 dark:hover:bg-white/5 dark:hover:text-white"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="flex flex-1 flex-col justify-center p-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-(--ct-accent-muted) text-(--ct-accent-strong)">
          <Bot className="size-6" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-zinc-950 dark:text-white">Assistant dock</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          Product navigation and investor guidance remain available while you review Series 1 data.
        </p>
      </div>
    </aside>
  );
}

/**
 * Admin shell — same SidebarLayout primitive as Series1Shell (KYC-reference
 * pattern: one shared layout primitive, two independent sidebars/navs). The
 * assistant dock is layered on top as a FAB + overlay, same as before.
 */
export function KycAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [assistantOpen, setAssistantOpen] = useState(false);

  return (
    <div className="relative">
      <SidebarLayout
        navbar={
          <Navbar>
            <NavbarSpacer />
            <NavbarSection />
          </Navbar>
        }
        sidebar={<AdminSidebar pathname={pathname} />}
      >
        {children}
      </SidebarLayout>

      <button
        type="button"
        onClick={() => setAssistantOpen(true)}
        aria-label="Open assistant"
        className="fixed bottom-5 right-5 z-20 hidden size-12 items-center justify-center rounded-xl bg-(--ct-accent) text-zinc-950 shadow-lg transition-transform hover:scale-105 lg:flex"
      >
        <Bot className="size-5" />
      </button>
      {assistantOpen ? <AssistantDock onClose={() => setAssistantOpen(false)} /> : null}
    </div>
  );
}
