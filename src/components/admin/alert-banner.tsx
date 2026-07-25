import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type AlertBannerTone = "error" | "warning" | "info";

/**
 * Colour doctrine (admin canon, greenfield tokens only — theme.css @theme,
 * no --ct-* shims):
 * - `error`   → --color-danger. RESERVED for blocking errors and failed
 *   validation — never for emphasis or "important info".
 * - `warning` → --color-warning. Degraded/caution states the operator must
 *   notice but that do not block.
 * - `info`    → grey (muted text on a faint foreground wash). Neutral notices.
 */
const TONE_CLASSES: Record<AlertBannerTone, string> = {
  error:
    "border-[color-mix(in_srgb,var(--color-danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] text-danger",
  warning:
    "border-[color-mix(in_srgb,var(--color-warning)_25%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_8%,transparent)] text-warning",
  info: "border-border bg-[color-mix(in_srgb,var(--color-foreground)_4%,transparent)] text-muted",
};

/** Default politeness per tone: only blocking errors interrupt (role=alert). */
const DEFAULT_ROLE: Record<AlertBannerTone, "alert" | "status"> = {
  error: "alert",
  warning: "status",
  info: "status",
};

export interface AlertBannerProps {
  tone: AlertBannerTone;
  /**
   * ARIA live-region role. Defaults per tone (error → "alert",
   * warning/info → "status"). Override it e.g. for an error-toned
   * precondition that should not interrupt the reader (role="status").
   */
  role?: "alert" | "status";
  /** Optional bold first line above the body. */
  title?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Admin alert banner — the single primitive replacing the ad hoc
 * role=status/alert boxes repeated across admin screens.
 * Server component, zero client dependencies.
 */
export function AlertBanner({
  tone,
  role,
  title,
  children,
  className,
}: AlertBannerProps) {
  return (
    <div
      role={role ?? DEFAULT_ROLE[tone]}
      className={cn(
        "rounded-lg border px-4 py-3 text-sm leading-relaxed",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {title ? <p className="m-0 font-medium">{title}</p> : null}
      <div className={cn(title && "mt-1")}>{children}</div>
    </div>
  );
}
