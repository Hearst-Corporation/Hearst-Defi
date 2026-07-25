"use client";

import { type ReactNode } from "react";

import { Header } from "@/shell/header";
import { Sidebar } from "@/shell/sidebar";

export function AppShell({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="grid h-dvh min-h-dvh grid-cols-[var(--width-sidebar)_minmax(0,1fr)] bg-background">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <Header title={title} subtitle={subtitle} />
        <main id="main-content" className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
