import Link from "next/link";

import { cn } from "@/lib/cn";

interface AdvancedModeToggleProps {
  /** Active mode resolved from the `?mode=` query param on the server. */
  active: "simple" | "advanced";
  /** Active vault id — preserved when switching mode (ADR-006 #9). */
  vaultId?: string;
}

function dashboardHref(mode: "simple" | "advanced", vaultId?: string): string {
  const params = new URLSearchParams();
  if (vaultId && vaultId !== "yield") {
    params.set("vault", vaultId);
  }
  if (mode === "advanced") {
    params.set("mode", "advanced");
  }
  const qs = params.toString();
  return qs ? `/admin/dashboard?${qs}` : "/admin/dashboard";
}

/**
 * Simple / Advanced segmented switch for the dashboard. Pure server component:
 * anchored links bind mode to `?mode=` and preserve the active `?vault=`.
 */
export function AdvancedModeToggle({ active, vaultId }: AdvancedModeToggleProps) {
  return (
    <nav
      className="inline-flex gap-1 ct-seg-track"
      aria-label="Dashboard mode"
    >
      <Link
        href={dashboardHref("simple", vaultId)}
        className={cn("ct-seg-btn", active === "simple" && "active")}
        aria-current={active === "simple" ? "page" : undefined}
      >
        Simple
      </Link>
      <Link
        href={dashboardHref("advanced", vaultId)}
        className={cn("ct-seg-btn", active === "advanced" && "active")}
        aria-current={active === "advanced" ? "page" : undefined}
      >
        Advanced
      </Link>
    </nav>
  );
}
