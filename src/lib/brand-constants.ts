/** Literal hex for JS SDKs (Privy, etc.) — CSS source of truth: `--ct-accent` in cockpit.css */
export const CONNECT_ACCENT_HEX = "#A7FB90" as const;

/**
 * Literal hex for canvas 2D (cannot read CSS vars) — CSS source of truth:
 * `--ct-status-danger` in cockpit.css (resolves `--ct-status-danger` →
 * `--ct-figma-status-danger` → #ba3f1d). Used for "failed" node state.
 */
export const CONNECT_STATUS_DANGER_HEX = "#ba3f1d" as const;
