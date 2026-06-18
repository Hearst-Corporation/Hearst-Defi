import Link from "next/link";

import { cn } from "@/lib/cn";

/** Hub-only link to a portfolio leaf page (focused full view). */
export function PortfolioLeafLink({
  href,
  label = "View full",
  className,
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("pf-panel-leaf-link", className)}>
      <span className="pf-panel-leaf-link__label">{label}</span>
      <span className="pf-panel-leaf-link__arrow" aria-hidden>
        →
      </span>
    </Link>
  );
}
