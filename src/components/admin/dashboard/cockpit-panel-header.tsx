import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Quiet "View full →" link for the panel header trail.
 * Mirrors PortfolioLeafLink / .pf-panel-leaf-link style
 * using the admin-scoped .dashboard-cockpit-leaf-link class (inline, not corner).
 */
export function AdminLeafLink({
  href,
  label = "View full",
  className,
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("dashboard-cockpit-leaf-link", className)}>
      <span>{label}</span>
      <span aria-hidden> →</span>
    </Link>
  );
}
