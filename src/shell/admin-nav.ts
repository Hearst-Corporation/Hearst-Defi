import {
  Activity,
  FileCheck,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Network,
  Scale,
  Settings2,
  ShieldCheck,
  Users,
  Vault,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  hideFromSubNav?: boolean;
};

export type AdminSection = {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  tabs: AdminNavItem[];
};

export const ADMIN_SECTIONS: AdminSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/admin/dashboard",
    tabs: [
      { id: "overview", label: "Overview", href: "/admin/dashboard", icon: LayoutDashboard },
      { id: "customers", label: "Investors", href: "/admin/customers", icon: Users },
      { id: "feedback", label: "Feedback", href: "/admin/feedback", icon: MessageSquare },
    ],
  },
  {
    id: "vaults",
    label: "Vaults",
    icon: Vault,
    href: "/admin/vaults",
    tabs: [
      { id: "vaults", label: "Overview", href: "/admin/vaults", icon: Vault },
      { id: "distributions", label: "Reserve Events", href: "/admin/distributions", icon: FileText },
      { id: "signals", label: "Rebalancing", href: "/admin/signals", icon: Zap },
    ],
  },
  {
    id: "proof",
    label: "Proof & System",
    icon: ShieldCheck,
    href: "/admin/proofs",
    tabs: [
      { id: "proofs", label: "Proofs", href: "/admin/proofs", icon: FileCheck },
      { id: "monitoring", label: "Monitoring", href: "/admin/monitoring", icon: Settings2 },
      { id: "security", label: "Security", href: "/admin/security", icon: ShieldCheck },
      { id: "governance", label: "Governance", href: "/admin/governance", icon: Scale },
      { id: "allowlist", label: "Allowlist", href: "/admin/governance/allowlist", icon: Users },
      { id: "diagnostics", label: "Diagnostics", href: "/admin/diagnostics", icon: Activity, hideFromSubNav: true },
      { id: "architecture", label: "Architecture", href: "/admin/system/architecture", icon: Network },
    ],
  },
];

export function getAdminSection(pathname: string): AdminSection | undefined {
  return ADMIN_SECTIONS.find(
    (s) => pathname === s.href || pathname.startsWith(`${s.href}/`) ||
      s.tabs.some((t) => pathname === t.href || pathname.startsWith(`${t.href}/`)),
  );
}

export function visibleTabs(section: AdminSection): AdminNavItem[] {
  return section.tabs.filter((t) => !t.hideFromSubNav);
}
