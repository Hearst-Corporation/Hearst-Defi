/**
 * Validates a `?from=` query param for safe client-side redirect.
 *
 * Returns the path if it's a same-origin relative URL:
 *  - starts with `/`
 *  - not `//` (protocol-relative)
 *  - not `/\` (browsers normalize `\` → `/`, becoming `//`)
 *  - no backslash or control character anywhere (CWE-601 defense-in-depth)
 *
 * Otherwise returns the fallback (default `/portfolio` — the investor home, the
 * "My Position" page a signed-in user lands on (MONDE B, 2026-07-25). The old
 * `/dashboard` fund overview is retired to a redirect stub that also lands here).
 */
const UNSAFE_CHARS = /[\x00-\x1f\\]/;

export function safeFrom(from: string | null | undefined, fallback = "/portfolio"): string {
  if (!from) return fallback;
  if (!from.startsWith("/")) return fallback;
  if (from.startsWith("//")) return fallback;
  if (UNSAFE_CHARS.test(from)) return fallback;
  return from;
}
