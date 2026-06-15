import { z } from "zod";

/**
 * Parse a JSON string column that is expected to hold a flat `string[]`
 * (e.g. `Vault.signersWhitelist`, `RebalanceEvent.approvedBy`).
 *
 * Replaces the scattered `JSON.parse(col ?? "[]") as string[]` casts: those
 * trusted the DB blindly — a malformed row or a non-array payload would slip
 * through as the wrong shape. Here the value is JSON-parsed AND Zod-validated,
 * so a bad column throws a clear error instead of corrupting downstream logic
 * (signer whitelisting, multisig approval sets).
 *
 * @param raw the stored JSON string, or null/undefined (treated as "[]")
 * @param label short context used in the thrown error message
 * @returns the validated string array
 * @throws if the column is not valid JSON or not an array of strings
 */
export function parseStringArray(
  raw: string | null | undefined,
  label: string,
): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? "[]");
  } catch {
    throw new Error(`Invalid ${label} format: not valid JSON`);
  }
  const result = z.array(z.string()).safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid ${label} format: expected string[]`);
  }
  return result.data;
}
