import { AlertBanner } from "@/components/admin/alert-banner";

export interface ScopeFallbackNoticeProps {
  /** The raw `?vault=` value that did not resolve. */
  requested: string;
  /** Label of the scope actually shown (e.g. the Series 1 flagship). */
  resolvedLabel: string;
  className?: string;
}

/**
 * Makes a vault-scope substitution VISIBLE on screen — the UI twin of
 * `resolveFixtureVault().usedFallback` (src/lib/vaults/dashboard-scope.ts),
 * today reduced to a console.warn in four admin screens. Render it whenever
 * `usedFallback && requested !== undefined`.
 *
 * Warning tone on purpose: a substituted scope is a caution the operator must
 * notice, not a blocking error — red stays reserved for errors.
 * Server component.
 */
export function ScopeFallbackNotice({
  requested,
  resolvedLabel,
  className,
}: ScopeFallbackNoticeProps) {
  return (
    <AlertBanner tone="warning" role="status" className={className}>
      Scope substituted — showing {resolvedLabel} instead of &quot;{requested}
      &quot; (unknown vault reference).
    </AlertBanner>
  );
}
