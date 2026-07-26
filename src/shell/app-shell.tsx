"use client";

import { type ReactNode } from "react";

import { Header } from "@/shell/header";
import { Sidebar } from "@/shell/sidebar";
import { SidebarScrim } from "@/shell/sidebar-toggle";

/**
 * Coque applicative investisseur.
 *
 * La grille est pilotée par `--hc-sidebar-w` (palette.css §5), résolu par le
 * script de boot AVANT la première peinture — donc pas d'état React pour la
 * largeur initiale : un flash de layout est bien plus visible qu'un flash de
 * couleur.
 *
 * Les props `title`/`subtitle` ont été retirées : elles n'étaient JAMAIS
 * fournies (`greenfield-chrome` appelle `<AppShell>` nu), ce qui laissait le
 * header vide à gauche. Le header porte désormais son propre contenu.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="hc-shell">
      <Sidebar />
      <SidebarScrim />
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <Header />
        <main id="main-content" className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
