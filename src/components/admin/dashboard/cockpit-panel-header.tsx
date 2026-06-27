import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Quiet "View full →" link for a bento panel header trail (the `trailing`
 * slot of BentoHeader / DashboardPanelHeader). Inline, not corner.
 *
 * Bento canon: micro zinc label that warms to accent-green (#A7FB90) on hover.
 * Pure Tailwind — no CSS-file dependency.
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
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.15em] text-zinc-500 transition-colors hover:text-[#A7FB90]",
        className,
      )}
    >
      <span>{label}</span>
      <span
        className="transition-transform group-hover:translate-x-0.5"
        aria-hidden
      >
        {" "}
        →
      </span>
    </Link>
  );
}
