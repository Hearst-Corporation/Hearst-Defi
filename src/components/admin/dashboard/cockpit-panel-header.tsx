import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Quiet "View full →" link for a bento panel header trail (the `trailing`
 * slot of BentoHeader / DashboardPanelHeader). Inline, not corner.
 *
 * Bento canon: micro muted label that warms to the accent green on hover.
 * Token-only (no raw zinc / no inline hex) — colours via `--ct-*`.
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
        "group inline-flex items-center gap-1 text-[length:var(--ct-text-micro)] font-medium uppercase tracking-[0.15em] text-[var(--ct-text-muted)] transition-colors hover:text-[var(--ct-accent)]",
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
