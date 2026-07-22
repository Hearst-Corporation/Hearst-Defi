// Presentation helpers shared by the Series 1 investor surfaces.
//
// Pure formatting over reads the caller already performed — no I/O, no ABI,
// no address resolution. `dynavault.ts` stays the single passage point.

import type { ReactNode } from "react";

import type { VaultMode } from "@/lib/chain/vault-mode";
import { reasonLabel, type Series1Wired } from "@/components/series1-shell/Series1Wired";

/**
 * Contract mode as an investor-facing sentence. "not_configured" is the honest
 * state today: v2.1 is written but its address has not been posted, so the app
 * runs on the prior deployment.
 */
export function vaultModeLabel(mode: VaultMode): string {
  switch (mode) {
    case "v2":
      return "PermissionedDynaVault v2.1";
    case "legacy":
      return "Legacy vault · v2.1 address TBD";
    case "not_configured":
      return "Contract not configured";
  }
}

/** The three Mining Note pockets, by strategy index (VAULT_SPEC_V2.1.md §6). */
export const POCKET_LABELS: Record<number, { id: "B1" | "B2" | "B3"; label: string }> = {
  0: { id: "B1", label: "Mining Power" },
  1: { id: "B2", label: "BTC Reserve" },
  2: { id: "B3", label: "Operating Reserve" },
};

/**
 * The Series 1 POLICY allocation, in bps by strategy index — a spec constant
 * (VAULT_SPEC_V2.1.md §6, 40/27/33), NOT a chain read. Surfaces may show it as
 * the configured target while the live `strategies()` read is unavailable, as
 * long as it is labeled policy/configured — never as a measured allocation.
 */
export const POLICY_TARGET_BPS: readonly number[] = [4000, 2700, 3300];

/**
 * Provenance tag for a chart fed by a wired read. Maps the adapter's motive
 * vocabulary instead of collapsing everything to "configured": an RPC outage
 * is an availability problem, not a configuration state.
 */
export function placeholderStatus(
  read: Series1Wired<unknown>,
): "live" | "configured" | "unavailable" {
  if (read.status === "wired") return "live";
  return read.reason === "rpc_error" || read.reason === "revert" || read.reason === "decode_error"
    ? "unavailable"
    : "configured";
}

/**
 * A KPI cell value. On `unavailable` it returns the MOTIVE, never a dash alone
 * and never a fabricated zero — the band stays readable while staying honest.
 */
export function wiredMetric<T>(read: Series1Wired<T>, render: (data: T) => ReactNode): ReactNode {
  return read.status === "wired" ? render(read.data) : reasonLabel(read.reason);
}
