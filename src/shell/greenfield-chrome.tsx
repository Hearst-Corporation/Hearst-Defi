"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

import { AppShell } from "@/shell/app-shell";
import { isAdminRoute, isBareRoute } from "@/shell/nav";

/**
 * Le shell admin est chargé à la demande : importé statiquement, il faisait
 * embarquer la sidebar admin (+ sa nav, + ses icônes) à TOUTE route
 * investisseur, et réciproquement. Le SSR est conservé (pas de `ssr: false`) —
 * on ne veut pas d'un flash de chrome sur les 23 routes admin, seulement un
 * chunk séparé.
 */
const AdminAppShell = dynamic(() =>
  import("@/shell/admin-shell").then((m) => m.AdminAppShell),
);

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
