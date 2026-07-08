/**
 * Validates a `?from=` query param for safe client-side redirect.
 *
 * Returns the path if it's a same-origin relative URL:
 *  - starts with `/`
 *  - not `//` (protocol-relative)
 *  - not `/\` (browsers normalize `\` → `/`, becoming `//`)
 *  - no backslash or control character anywhere (CWE-601 defense-in-depth)
 *
 * Otherwise returns the fallback (default `/portfolio` — the investor's real
 * financial dashboard, i.e. where a signed-in user should land by default. The
 * `/portfolio/preview` V4 console is a sandbox, kept off the rail).
 */
const UNSAFE_CHARS = /[\x00-\x1f\\]/;

export function safeFrom(from: string | null | undefined, fallback = "/portfolio"): string {
  if (!from) return fallback;
  if (!from.startsWith("/")) return fallback;
  if (from.startsWith("//")) return fallback;
  if (UNSAFE_CHARS.test(from)) return fallback;
  return from;
}
