"use client";

import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

import { AdminAppShell } from "@/shell/admin-shell";
import { AppShell } from "@/shell/app-shell";
import { isAdminRoute, isBareRoute } from "@/shell/nav";

export function GreenfieldChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (isBareRoute(pathname)) {
    return (
      <div className="min-h-dvh bg-background">
        <main id="main-content">{children}</main>
      </div>
    );
  }

  if (isAdminRoute(pathname)) {
    return <AdminAppShell>{children}</AdminAppShell>;
  }

  return <AppShell>{children}</AppShell>;
}
