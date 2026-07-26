"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { INVESTOR_NAV, matchesPath } from "@/shell/nav";

/**
 * Rail de navigation investisseur.
 *
 * L'état replié est porté par `[data-sidebar]` sur `<html>` et résolu en CSS
 * (`.hc-rail__label`, app.css) : rien ici ne dépend d'un état React, donc la
 * largeur ne saute jamais à l'hydratation.
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hc-rail" aria-label="Primary">
      <div className="flex h-(--height-header) items-center gap-2.5 border-b border-border-subtle px-4">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
          <Image
            src="/logos/hearst-connect.svg"
            alt=""
            width={22}
            height={22}
            className="size-5.5 shrink-0"
            // Un SVG local de 22 px ne gagne rien à passer par /_next/image —
            // c'est une requête de moins à la première visite.
            unoptimized
          />
          <span className="hc-rail__label min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">
              Hearst Connect
            </span>
            <span className="block truncate text-2xs uppercase tracking-[0.12em] text-subtle">
              Series 1
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-2" aria-label="Main">
        {INVESTOR_NAV.map((item) => {
          const active = matchesPath(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              // Tooltip natif : en mode replié, le libellé est masqué.
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-2.5 py-2",
                "text-sm font-medium transition-colors duration-(--dur-fast) ease-standard",
                active
                  ? "bg-accent-muted text-accent-ink"
                  : "text-muted hover:bg-surface-raised hover:text-foreground",
              )}
            >
              {/* Marqueur d'état 2px : il reste visible en replié, contrairement
                  au fond qui se réduit à un carré d'icône. */}
              <span
                aria-hidden
                className={cn(
                  "absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full",
                  active ? "bg-accent-ink" : "bg-transparent",
                )}
              />
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="hc-rail__label truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="hc-rail__label border-t border-border-subtle p-4">
        <p className="text-2xs leading-relaxed text-subtle">
          Estimated outcomes disclosed as a range — not guaranteed.
        </p>
      </div>
    </aside>
  );
}
