"use client";

import Link from "next/link";
import { type ReactNode } from "react";

import { Button } from "@/ui/button";
import { AdminSidebar, AdminSubNav } from "@/shell/admin-sidebar";

export function AdminAppShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-dvh min-h-dvh grid-cols-[var(--width-sidebar)_minmax(0,1fr)] bg-background">
      <AdminSidebar />
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <header className="flex h-(--height-header) items-center justify-between border-b border-border-subtle px-6">
          <span className="text-xs font-medium uppercase tracking-wider text-subtle">
            Operations
          </span>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              Investor view
            </Button>
          </Link>
        </header>
        <AdminSubNav />
        <main id="main-content" className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
