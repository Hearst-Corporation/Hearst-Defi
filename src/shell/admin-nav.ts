import {
  Activity,
  Database,
  FileCheck,
  FileText,
  FlaskConical,
  LayoutDashboard,
  MessageSquare,
  Network,
  Scale,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Users,
  Vault,
  Workflow,
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
      { id: "agentic", label: "Agents", href: "/admin/agentic", icon: Workflow },
      { id: "outreach", label: "Outreach", href: "/admin/outreach", icon: Send },
      { id: "feedback", label: "Feedback", href: "/admin/feedback", icon: MessageSquare },
    ],
  },
  {
    id: "strategy",
    label: "Strategy",
    icon: FlaskConical,
    href: "/admin/product-workspace",
    tabs: [
      { id: "workspace", label: "Overview", href: "/admin/product-workspace", icon: FileText },
      { id: "strategies", label: "Strategies", href: "/admin/strategies", icon: SlidersHorizontal },
      { id: "marketplace", label: "Marketplace", href: "/admin/marketplace", icon: TrendingUp },
      { id: "source", label: "Source", href: "/admin/source", icon: Database },
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
  {
    id: "operations",
    label: "Operations",
    icon: FileText,
    href: "/admin/roadmap",
    tabs: [
      { id: "roadmap", label: "Overview", href: "/admin/roadmap", icon: FileText },
      { id: "spec", label: "Spec", href: "/admin/spec", icon: FileCheck },
      { id: "memo", label: "Investor Memo", href: "/admin/investor-memo", icon: FileText },
      { id: "audit", label: "Audit Log", href: "/admin/audit", icon: FileCheck },
      { id: "design-system", label: "UI Kit", href: "/admin/design-system", icon: FileText },
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
