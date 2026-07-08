/**
 * Validates a `?from=` query param for safe client-side redirect.
 *
 * Returns the path if it's a same-origin relative URL:
 *  - starts with `/`
 *  - not `//` (protocol-relative)
 *  - not `/\` (browsers normalize `\` → `/`, becoming `//`)
 *  - no backslash or control character anywhere (CWE-601 defense-in-depth)
 *
 * Otherwise returns the fallback (default `/my-vaults` — the investor's real
 * per-account held-positions index, i.e. where a signed-in user should land by
 * default. The `/portfolio` V4 console is a sandbox preview, kept off the rail).
 */
const UNSAFE_CHARS = /[\x00-\x1f\\]/;

export function safeFrom(from: string | null | undefined, fallback = "/my-vaults"): string {
  if (!from) return fallback;
  if (!from.startsWith("/")) return fallback;
  if (from.startsWith("//")) return fallback;
  if (UNSAFE_CHARS.test(from)) return fallback;
  return from;
}
