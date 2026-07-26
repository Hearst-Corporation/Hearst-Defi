"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isAdminRoute } from "@/shell/nav";
import { SidebarToggle } from "@/shell/sidebar-toggle";
import { ThemeToggle } from "@/shell/theme-toggle";
import { Button } from "@/ui/button";

/**
 * En-tête applicatif.
 *
 * Les props `title`/`subtitle` ont été retirées : jamais fournies par
 * `greenfield-chrome`, elles laissaient toute la moitié gauche vide. Le header
 * porte désormais ce qui lui revient — repli du rail, bascule de thème, accès
 * croisé produit/admin — et devient `sticky` (il ne l'était pas, alors que
 * `<main>` défile sous lui).
 */
export function Header() {
  const pathname = usePathname();
  const isAdmin = isAdminRoute(pathname);

  return (
    <header className="sticky top-0 z-(--z-header) flex h-(--height-header) shrink-0 items-center gap-3 border-b border-border-subtle bg-surface/80 px-4 backdrop-blur-md">
      <SidebarToggle />
      <div className="hidden h-4 w-px bg-border sm:block" aria-hidden />
      <div className="min-w-0 flex-1" />

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <div className="h-4 w-px bg-border" aria-hidden />
        {isAdmin ? (
          <Link
            href="/dashboard"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
          >
            Investor view
          </Link>
        ) : (
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="sm">
              Admin
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}
