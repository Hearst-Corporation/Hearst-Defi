import {
  LayoutDashboard,
  Landmark,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
};

/** Investor rail — 4 destinations (doctrine 2026-07-24). */
export const INVESTOR_NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { id: "reserve", label: "Reserve", href: "/vaults", icon: Landmark },
  { id: "proof", label: "Proof", href: "/proof-center", icon: ShieldCheck },
  { id: "profile", label: "Profile", href: "/profile", icon: UserRound },
];

export function matchesPath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const BARE_ROUTES = new Set([
  "/",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/totp-challenge",
]);

export const BARE_PREFIXES = ["/legal", "/apply"] as const;

export function isBareRoute(pathname: string): boolean {
  if (BARE_ROUTES.has(pathname)) return true;
  return BARE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isAdminRoute(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
