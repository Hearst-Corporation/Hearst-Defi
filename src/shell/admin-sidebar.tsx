"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import {
  ADMIN_SECTIONS,
  getAdminSection,
  visibleTabs,
} from "@/shell/admin-nav";

export function AdminSidebar() {
  const pathname = usePathname();
  const activeSection = getAdminSection(pathname);

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-surface">
      <div className="flex h-(--height-header) items-center border-b border-border-subtle px-5">
        <Link href="/admin/dashboard" className="text-sm font-semibold text-foreground">
          Hearst Admin
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Admin">
        {ADMIN_SECTIONS.map((section) => {
          // getAdminSection already matches both the section href and its tabs.
          const active = activeSection?.id === section.id;
          const Icon = section.icon;
          return (
            <Link
              key={section.id}
              href={section.href}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-accent-muted font-semibold text-accent"
                  : "text-muted hover:bg-surface-raised hover:text-foreground",
              )}
            >
              <Icon
                className={cn("size-4 shrink-0", active && "text-accent")}
                aria-hidden
              />
              <span className="truncate">{section.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function AdminSubNav() {
  const pathname = usePathname();
  const section = getAdminSection(pathname);
  if (!section) return null;
  const tabs = visibleTabs(section);
  if (tabs.length <= 1) return null;

  return (
    <div className="border-b border-border-subtle bg-surface/80 px-6 py-2 backdrop-blur-sm">
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-surface-raised text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
