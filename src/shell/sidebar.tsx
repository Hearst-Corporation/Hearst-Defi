"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { INVESTOR_NAV, matchesPath } from "@/shell/nav";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-surface">
      <div className="flex h-(--height-header) items-center border-b border-border-subtle px-5">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/logos/hearst-connect.svg"
            alt=""
            width={24}
            height={24}
            className="size-6"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              Hearst Connect
            </p>
            <p className="truncate text-[10px] uppercase tracking-[0.12em] text-subtle">
              Series 1
            </p>
          </div>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Main">
        {INVESTOR_NAV.map((item) => {
          const active = matchesPath(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-accent-muted font-semibold text-accent"
                  : "text-muted hover:bg-surface-raised hover:text-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                className={cn("size-4 shrink-0", active && "text-accent")}
                aria-hidden
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border-subtle p-4">
        <p className="text-[11px] leading-relaxed text-subtle">
          Estimated outcomes disclosed as a range — not guaranteed.
        </p>
      </div>
    </aside>
  );
}
