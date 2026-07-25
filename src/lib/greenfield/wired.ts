import type { ReactNode } from "react";

import type { VaultMode } from "@/lib/chain/vault-mode";

export type WiredRead<T> =
  | { status: "wired"; data: T }
  | { status: "unavailable"; reason: string; detail?: string };

export function reasonLabel(reason: string): string {
  const map: Record<string, string> = {
    not_configured: "Not configured",
    not_supported: "Not supported",
    no_wallet: "No wallet linked",
    rpc_error: "RPC unavailable",
    revert: "Contract read failed",
    decode_error: "Decode error",
    "backend:unreachable": "Backend unreachable",
    "backend:not_supported": "Not exposed by backend",
    no_investor_record: "No investor record",
    db_error: "Database error",
  };
  return map[reason] ?? reason.replace(/_/g, " ");
}

export function vaultModeLabel(mode: VaultMode | string): string {
  switch (mode) {
    case "v2":
      return "PermissionedDynaVault v2.1";
    case "legacy":
      return "Legacy vault · v2.1 address TBD";
    case "not_configured":
      return "Contract not configured";
    default:
      return String(mode);
  }
}

export function wiredMetric<T>(
  read: WiredRead<T>,
  render: (data: T) => ReactNode,
): ReactNode {
  return read.status === "wired" ? render(read.data) : reasonLabel(read.reason);
}

export const POCKET_LABELS: Record<number, { id: string; label: string }> = {
  0: { id: "B1", label: "Mining Power" },
  1: { id: "B2", label: "BTC Reserve" },
  2: { id: "B3", label: "Operating Reserve" },
};

export const POLICY_TARGET_BPS: readonly number[] = [4000, 2700, 3300];
