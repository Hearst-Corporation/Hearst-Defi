// Router Observability v0 — redaction helpers (pure).
//
// v0 stores NO message snippet at all (see decision-summary.ts — the user-text
// fields are simply never copied). This module exists so that IF a future version
// ever opts into an optional, admin-only snippet, there is ONE audited place that
// truncates + scrubs it. It is intentionally conservative and unused on the hot
// path today.

/** Hard cap on any optional snippet (chars). Kept small on purpose. */
export const MAX_SNIPPET_LEN = 80;

// Control characters (C0 + DEL), excluding the whitespace the collapse handles.
const CONTROL_CHAR_RE = new RegExp("[\\x00-\\x1F\\x7F]", "g");
const SK_KEY_RE = /\b[sS][kK]-[A-Za-z0-9_-]{8,}\b/g;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const SECRET_RE = /\b(?:Bearer|token|secret|password)\s*[:=]?\s*\S+/gi;

/**
 * Truncate + scrub an optional text snippet to a safe, bounded form.
 *
 * - strips control characters,
 * - collapses whitespace,
 * - removes anything that looks like a key/token/email (defence-in-depth),
 * - caps to MAX_SNIPPET_LEN with an ellipsis.
 *
 * Returns undefined for empty input so callers can omit the field entirely.
 */
export function redactSnippet(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  let s = value.replace(CONTROL_CHAR_RE, " ").replace(/\s+/g, " ").trim();
  if (!s) return undefined;
  s = s
    .replace(SK_KEY_RE, "[redacted]")
    .replace(EMAIL_RE, "[email]")
    .replace(SECRET_RE, "[redacted]");
  if (s.length > MAX_SNIPPET_LEN) {
    s = s.slice(0, MAX_SNIPPET_LEN - 1).trimEnd() + "…";
  }
  return s;
}
