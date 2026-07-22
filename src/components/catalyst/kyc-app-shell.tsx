"use client";

import * as Headless from "@headlessui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  BarChart3,
  Bitcoin,
  Bot,
  ChevronLeft,
  FileText,
  LayoutDashboard,
  Menu,
  Pickaxe,
  PieChart,
  Settings,
  ShieldCheck,
  Vault,
  X,
} from "lucide-react";

import { cn } from "@/lib/cn";
import {
  ADMIN_SECTIONS,
  PRODUCT_NAV,
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

function isActive(pathname: string, href: string) {
  return matchesNavPath(pathname, href);
}

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = iconMap[item.icon] ?? LayoutDashboard;
  const current = isActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      aria-current={current ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        current
          ? "bg-zinc-950/5 text-zinc-950 dark:bg-white/8 dark:text-white"
          : "text-zinc-600 hover:bg-zinc-950/4 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white",
      )}
    >
      {current ? (
        <span className="absolute inset-y-2 -left-4 w-0.5 rounded-full bg-emerald-500" />
      ) : null}
      <Icon className="size-5 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function Sidebar({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const admin = pathname.startsWith("/admin");
  const items = admin
    ? ADMIN_SECTIONS.map((section) => ({
        id: section.id,
        label: section.label,
        href: section.href,
        icon: section.icon,
      }))
    : PRODUCT_NAV;

  return (
    <nav className="flex h-full min-h-0 flex-col" aria-label={admin ? "Admin navigation" : "Investor navigation"}>
      <div className="border-b border-zinc-950/8 p-5 dark:border-white/8">
        <Link href={admin ? "/admin/dashboard" : "/dashboard"} className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-400 text-sm font-bold text-zinc-950">
            H
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-zinc-950 dark:text-white">
              Hearst
            </span>
            <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
              Bitcoin Reserve Vault · Series 1
            </span>
          </span>
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        <div className="flex flex-col gap-0.5">
          {items.map((item) => (
            <NavLink key={item.id} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      </div>

      {admin ? (
        <div className="border-t border-zinc-950/8 p-4 dark:border-white/8">
          <Link
            href="/dashboard"
            onClick={onNavigate}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-950/4 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
          >
            <LayoutDashboard className="size-5" />
            Investor view
          </Link>
        </div>
      ) : null}
    </nav>
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
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-500">
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

export function KycAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const admin = pathname.startsWith("/admin");
  const label = admin
    ? ADMIN_SECTIONS.find((section) => isActive(pathname, section.href))?.label ?? "Admin"
    : PRODUCT_NAV.find((item) => isActive(pathname, item.href))?.label ?? "Overview";

  useEffect(() => {
    document.documentElement.classList.add("kyc-front");
    return () => document.documentElement.classList.remove("kyc-front");
  }, []);

  return (
    <div className="kyc-app-root kyc-cockpit-shell min-h-dvh text-zinc-950">
      <style jsx global>{`
        html.kyc-front,
        html.kyc-front body {
          height: auto !important;
          min-height: 100dvh !important;
          overflow: visible !important;
          background: color-mix(in srgb, var(--ct-bg-deep) 14%, white) !important;
        }
        .kyc-cockpit-shell {
          --kyc-cockpit-canvas: color-mix(in srgb, var(--ct-bg-deep) 18%, white);
          --kyc-cockpit-frame: color-mix(in srgb, var(--ct-bg-deep) 4%, white);
          --kyc-cockpit-panel: color-mix(in srgb, var(--ct-bg-deep) 8%, white);
          --kyc-cockpit-inset: color-mix(in srgb, var(--ct-bg-deep) 9%, white);
          --kyc-cockpit-line: color-mix(in srgb, var(--ct-bg-deep) 16%, transparent);
          --kyc-cockpit-accent: color-mix(in srgb, var(--ct-accent) 48%, var(--ct-bg-deep));
          background:
            radial-gradient(circle at 92% -8%, color-mix(in srgb, var(--ct-accent) 11%, transparent), transparent 31rem),
            var(--kyc-cockpit-canvas);
        }
        .kyc-cockpit-shell .kyc-cockpit-sidebar {
          background: color-mix(in srgb, var(--ct-bg-deep) 8%, white);
          border-color: var(--kyc-cockpit-line);
        }
        .kyc-cockpit-shell .kyc-cockpit-frame {
          background:
            linear-gradient(145deg, color-mix(in srgb, var(--ct-accent) 4%, transparent), transparent 28rem),
            var(--kyc-cockpit-frame);
          box-shadow: var(--ct-shadow-soft);
          border-color: var(--kyc-cockpit-line);
        }
        .kyc-cockpit-shell .kyc-cockpit-section {
          border-color: var(--kyc-cockpit-line);
        }
        .kyc-cockpit-shell .kyc-cockpit-frame {
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, white 80%, transparent),
            0 18px 48px -28px color-mix(in srgb, var(--ct-bg-deep) 42%, transparent);
        }
        .kyc-cockpit-shell .kyc-cockpit-panel,
        .kyc-cockpit-shell .kyc-cockpit-chart,
        .kyc-cockpit-shell .kyc-cockpit-kpi {
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--ct-accent) 3%, transparent), transparent 16rem),
            var(--kyc-cockpit-panel);
          box-shadow: inset 0 1px 0 color-mix(in srgb, white 70%, transparent), var(--ct-shadow-soft);
          border: 1px solid var(--kyc-cockpit-line);
        }
        .kyc-cockpit-shell .kyc-cockpit-chart figcaption,
        .kyc-cockpit-shell .kyc-cockpit-panel > div:first-child {
          border-color: var(--kyc-cockpit-line);
        }
        .kyc-cockpit-shell .kyc-cockpit-empty {
          background: color-mix(in srgb, var(--ct-bg-deep) 3%, white);
          border-color: color-mix(in srgb, var(--ct-bg-deep) 22%, transparent);
        }
        .kyc-cockpit-shell .kyc-cockpit-kpi > div,
        .kyc-cockpit-shell .kyc-cockpit-kpi dl {
          background: var(--kyc-cockpit-line);
        }
        .kyc-cockpit-shell .kyc-cockpit-kpi > div > div,
        .kyc-cockpit-shell .kyc-cockpit-kpi dl > div {
          background: color-mix(in srgb, var(--ct-bg-deep) 4%, white);
        }
        .kyc-cockpit-shell .kyc-cockpit-kpi > div > div:first-child {
          background:
            linear-gradient(140deg, color-mix(in srgb, var(--ct-accent) 13%, transparent), transparent 18rem),
            color-mix(in srgb, var(--ct-bg-deep) 7%, white);
        }
      `}</style>
      <aside className="kyc-cockpit-sidebar fixed inset-y-0 left-0 z-30 hidden w-64 border-r lg:block">
        <Sidebar pathname={pathname} />
      </aside>

      <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-zinc-950/8 bg-white/95 px-4 backdrop-blur dark:border-white/8 dark:bg-zinc-900/95 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="flex size-11 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-950/5 dark:text-zinc-300 dark:hover:bg-white/5"
        >
          <Menu className="size-5" />
        </button>
        <div className="min-w-0 text-center">
          <p className="text-xs font-semibold uppercase tracking-uppercase text-emerald-600 dark:text-emerald-400">Series 1</p>
          <p className="truncate text-sm font-semibold">{label}</p>
        </div>
        <button
          type="button"
          onClick={() => setAssistantOpen(true)}
          aria-label="Open assistant"
          className="flex size-11 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-950/5 dark:text-zinc-300 dark:hover:bg-white/5"
        >
          <Bot className="size-5" />
        </button>
      </header>

      <Headless.Dialog open={mobileOpen} onClose={setMobileOpen} className="lg:hidden">
        <Headless.DialogBackdrop className="fixed inset-0 z-40 bg-black/30" />
        <Headless.DialogPanel className="fixed inset-y-0 left-0 z-50 w-full max-w-80 bg-white shadow-2xl dark:bg-zinc-900">
          <div className="absolute right-3 top-3 z-10">
            <Headless.CloseButton className="flex size-11 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-950/5 dark:hover:bg-white/5">
              <ChevronLeft className="size-5" />
            </Headless.CloseButton>
          </div>
          <Sidebar pathname={pathname} onNavigate={() => setMobileOpen(false)} />
        </Headless.DialogPanel>
      </Headless.Dialog>

      <main className="min-w-0 lg:pl-64">
        <div className="min-h-[calc(100dvh-0.5rem)] p-4 sm:p-6 lg:p-2">
          <div className="kyc-cockpit-frame mx-auto min-h-[calc(100dvh-1rem)] max-w-[1600px] rounded-xl border p-5 sm:p-7 lg:p-10">
            {children}
          </div>
        </div>
      </main>

      <button
        type="button"
        onClick={() => setAssistantOpen(true)}
        aria-label="Open assistant"
        className="fixed bottom-5 right-5 z-20 hidden size-12 items-center justify-center rounded-xl bg-emerald-400 text-zinc-950 shadow-lg transition-transform hover:scale-105 lg:flex"
      >
        <Bot className="size-5" />
      </button>
      {assistantOpen ? <AssistantDock onClose={() => setAssistantOpen(false)} /> : null}
    </div>
  );
}
