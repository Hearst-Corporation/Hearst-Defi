import Link from "next/link";

import { cn } from "@/lib/cn";

/**
 * Vault option shape consumed by the selector. `isLive` is optional — when
 * omitted, the selector falls back to a heuristic (only `yield` is treated as
 * live, matching `isYieldVaultRow` in `src/lib/data/vaults.ts`). Pass an
 * explicit boolean (e.g. from `listAllVaults()`) once live deployments exist
 * for other ids.
 */
export interface VaultSelectorOption {
  id: string;
  label: string;
  /**
   * `true` → vault has a real `VaultSnapshot` backing it (numbers are live).
   * `false` → vault renders engine preset values only (no on-chain / DB data
   * yet). Surfaces a "preset" badge in the tab so admins don't mistake the
   * zeroes for real AUM.
   */
  isLive?: boolean;
}

/** Default fixtures-only catalog. Used when no `options` prop is provided. */
const DEFAULT_VAULT_OPTIONS: ReadonlyArray<VaultSelectorOption> = [
  { id: "yield", label: "Yield", isLive: true },
  { id: "defensive", label: "Defensive", isLive: false },
  { id: "btc-plus", label: "BTC Plus", isLive: false },
];

export interface VaultSelectorProps {
  /** Currently active vault id (resolved from `?vault=` on the server). */
  active: string;
  /**
   * Vault catalog to render. When omitted, falls back to the 3 engine fixtures
   * (yield / defensive / btc-plus). Pass a list mixing fixtures + live
   * deployments (built via `listAllVaults()` + `vaultSlug` / `vaultLabel`)
   * to surface wizard-created vaults in the rail.
   */
  options?: ReadonlyArray<VaultSelectorOption>;
  /** Base path to anchor links against — defaults to `/admin/dashboard`. */
  basePath?: string;
  /**
   * Extra query params to preserve when switching vaults. Lets the dashboard
   * keep `?mode=advanced` (and any other admin toggle) live across vault
   * changes. Empty strings / nullish values are dropped.
   */
  preserveParams?: Record<string, string | undefined>;
  /** ARIA label for the segmented control. */
  ariaLabel?: string;
}

/**
 * Multi-vault selector (ADR-006 #9). Pure Server Component — three anchored
 * links bound to `?vault=`. Reuses the existing `.ct-seg-track` / `.ct-seg-btn`
 * design-system primitives (same pattern as `AdvancedModeToggle`), so no new
 * tokens or classes are introduced.
 *
 * The selector NEVER mixes vault data — switching vaults navigates to a fresh
 * URL where the loader re-anchors all metadata on the chosen vault.
 */
export function VaultSelector({
  active,
  options = DEFAULT_VAULT_OPTIONS,
  basePath = "/admin/dashboard",
  preserveParams,
  ariaLabel = "Vault selector",
}: VaultSelectorProps) {
  return (
    <nav className="inline-flex gap-1 ct-seg-track" aria-label={ariaLabel}>
      {options.map((opt) => {
        const params = new URLSearchParams();
        if (opt.id !== "yield") params.set("vault", opt.id);
        if (preserveParams) {
          for (const [key, value] of Object.entries(preserveParams)) {
            if (value !== undefined && value !== "") {
              params.set(key, value);
            }
          }
        }
        const qs = params.toString();
        const href = qs ? `${basePath}?${qs}` : basePath;
        const isActive = opt.id === active;
        // Default heuristic: only `yield` is backed by a real VaultSnapshot
        // today (ADR-006 #9). Caller can override per-option via `isLive`.
        const isLive = opt.isLive ?? opt.id === "yield";
        return (
          <Link
            key={opt.id}
            href={href}
            className={cn("ct-seg-btn", isActive && "active")}
            aria-current={isActive ? "page" : undefined}
            title={
              isLive ? undefined : "Preset only · values from engine fixture, not live data"
            }
          >
            <span className="inline-flex items-center gap-1.5">
              {opt.label}
              {!isLive ? (
                <span
                  className="ct-text-faint text-micro uppercase tracking-wide leading-none"
                  aria-label="preset only, not live"
                >
                  preset
                </span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
