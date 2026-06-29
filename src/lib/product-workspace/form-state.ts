import "server-only";

/**
 * Parse a `vaultDraft.formState` JSON blob into a plain object.
 *
 * The column holds a JSON string keyed by feature (e.g. `productWorkspace`,
 * `constructionReport`). A missing, malformed, or non-object payload yields an
 * empty object so callers can read their key defensively. Shared by every
 * product-workspace reader/writer so the parse contract stays in one place.
 */
export function parseFormState(
  raw: string | null | undefined,
): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
