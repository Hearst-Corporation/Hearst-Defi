"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isAdminRoute } from "@/shell/nav";
import { Button } from "@/ui/button";

export function Header({
  title,
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  const pathname = usePathname();
  const isAdmin = isAdminRoute(pathname);

  return (
    <header className="flex h-(--height-header) shrink-0 items-center justify-between border-b border-border-subtle bg-background/80 px-6 backdrop-blur-sm">
      <div className="min-w-0">
        {title ? (
          <>
            <h1 className="truncate text-sm font-semibold text-foreground">
              {title}
            </h1>
            {subtitle ? (
              <p className="truncate text-xs text-muted">{subtitle}</p>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
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
