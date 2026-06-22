/**
 * BTC tactical posture — admin cockpit vault metrics.
 *
 * `VaultSnapshot.mode` is vault risk mode (`defensive` | `balanced` | `opportunistic`),
 * NOT BTC tactical posture. Never infer tactical posture from snapshot mode.
 */

export const BTC_TACTICAL_POSTURES = [
  "neutral",
  "long",
  "short",
  "hedge",
] as const;

export type BtcTacticalPosture = (typeof BTC_TACTICAL_POSTURES)[number];

const VAULT_RISK_MODES = new Set(["defensive", "balanced", "opportunistic"]);

export function isBtcTacticalPosture(value: string): value is BtcTacticalPosture {
  return (BTC_TACTICAL_POSTURES as readonly string[]).includes(value);
}

/** True when a string is a vault risk mode — must never surface as BTC posture. */
export function isVaultRiskMode(value: string): boolean {
  return VAULT_RISK_MODES.has(value);
}

/**
 * Resolves BTC tactical posture only from an explicit feed value.
 * Returns null when no dedicated posture field exists (honest unavailable).
 */
export function resolveVaultBtcPosture(
  explicitPosture: string | null | undefined,
): BtcTacticalPosture | null {
  if (explicitPosture == null || explicitPosture === "") return null;
  return isBtcTacticalPosture(explicitPosture) ? explicitPosture : null;
}

export function formatBtcPostureLabel(posture: BtcTacticalPosture | null): string {
  if (posture === null) return "Unavailable";
  return posture.charAt(0).toUpperCase() + posture.slice(1);
}
