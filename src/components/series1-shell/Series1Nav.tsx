"use client";

import Link from "next/link";
import { type ComponentType } from "react";
import {
  FileText,
  LayoutDashboard,
  PieChart,
  ShieldCheck,
  Vault,
} from "lucide-react";

import { cn } from "@/lib/cn";
import { matchesNavPath } from "@/components/nav/product-nav-items";

export type Series1NavItem = {
  id: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

/**
 * The five investor surfaces. Bitcoin Reserve, Mining, Ledger and My Vaults
 * were folded in: their routes now redirect (see each route's page.tsx) rather
 * than standing as separate destinations, so the rail carries one entry per
 * real surface instead of a menu of near-duplicates.
 */
export const SERIES1_NAV: Series1NavItem[] = [
  { id: "overview", label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { id: "vaults", label: "Series 1 Vault", href: "/vaults", icon: Vault },
  { id: "portfolio", label: "My Position", href: "/portfolio", icon: PieChart },
  { id: "proof-center", label: "Proof Center", href: "/proof-center", icon: ShieldCheck },
  { id: "documents-kyc", label: "Documents & KYC", href: "/profile", icon: FileText },
];

export function Series1Nav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex h-full min-h-0 flex-col" aria-label="Investor navigation">
      <div className="border-b p-5" style={{ borderColor: "var(--s1-line)" }}>
        <Link href="/dashboard" className="flex items-center gap-3">
          {/* Monogram: a dark plate edged in accent, not a green tile. The
              accent survives as the letter and the border — signal, not paint. */}
          <span
            className="flex size-9 items-center justify-center rounded-lg border text-sm font-bold"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0)), var(--s1-panel-elevated)",
              borderColor: "var(--s1-accent-line)",
              color: "var(--s1-accent)",
              boxShadow:
                "inset 0 1px 0 var(--s1-highlight), 0 0 12px -4px rgba(167,251,144,0.22)",
            }}
          >
            H
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">Hearst</span>
            <span className="block truncate text-xs" style={{ color: "var(--s1-muted)" }}>
              Bitcoin Reserve Vault · Series 1
            </span>
          </span>
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        <div className="flex flex-col gap-0.5">
          {SERIES1_NAV.map((item) => {
            const current = matchesNavPath(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={current ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  "relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                )}
                style={{
                  // Active state carries its weight in the raised neutral fill;
                  // the accent is left to the 1px marker alone.
                  background: current
                    ? "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0)), var(--s1-panel-elevated)"
                    : "transparent",
                  color: current ? "var(--s1-text)" : "var(--s1-muted)",
                  boxShadow: current
                    ? "inset 0 1px 0 var(--s1-highlight), 0 8px 18px -14px rgba(0,0,0,0.8)"
                    : undefined,
                }}
              >
                {current ? (
                  <span
                    className="absolute inset-y-2.5 -left-4 w-px rounded-full"
                    style={{
                      background: "var(--s1-accent)",
                      boxShadow: "0 0 8px -1px rgba(167,251,144,0.45)",
                    }}
                  />
                ) : null}
                <Icon className="size-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
