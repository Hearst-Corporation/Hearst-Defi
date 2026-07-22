"use client";

import Link from "next/link";
import { type ComponentType } from "react";
import {
  Bitcoin,
  FileText,
  LayoutDashboard,
  Pickaxe,
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

export const SERIES1_NAV: Series1NavItem[] = [
  { id: "overview", label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { id: "bitcoin-reserve", label: "Bitcoin Reserve", href: "/btc", icon: Bitcoin },
  { id: "vaults", label: "Vaults", href: "/vaults", icon: Vault },
  { id: "portfolio", label: "Portfolio", href: "/portfolio", icon: PieChart },
  { id: "proof-center", label: "Proof Center", href: "/proof-center", icon: ShieldCheck },
  { id: "mining", label: "Mining", href: "/mining", icon: Pickaxe },
  { id: "ledger", label: "Ledger", href: "/btc/ledger", icon: FileText },
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
          <span
            className="flex size-9 items-center justify-center rounded-lg text-sm font-bold"
            style={{ background: "var(--s1-accent)", color: "#08130a" }}
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
                  background: current
                    ? "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0)), var(--s1-panel-soft)"
                    : "transparent",
                  color: current ? "var(--s1-text)" : "var(--s1-muted)",
                  boxShadow: current ? "inset 0 1px 0 var(--s1-highlight)" : undefined,
                }}
              >
                {current ? (
                  <span
                    className="absolute inset-y-2 -left-4 w-0.5 rounded-full"
                    style={{ background: "var(--s1-accent)" }}
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
