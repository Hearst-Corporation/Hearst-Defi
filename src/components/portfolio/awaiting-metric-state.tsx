/**
 * AwaitingMetricState — light, self-contained empty surface for a widget whose
 * primary data is missing.
 *
 * Design contract (`docs/DESIGN_SYSTEM.md` §9.3):
 * **Empty states replace active module surfaces; they are not rendered inside
 * active module surfaces.**
 *
 * Callers must early-return this component when primary metric data is missing —
 * never wrap it in `dash-cell-premium`, headers, provenance badges, or nested
 * callouts inside an active card. Renders `.pf-empty-widget`: single calm
 * message, optional detail line, optional discreet link. No dashed border, no
 * hardcoded fallback values presented as live data.
 */
import Link from "next/link";

export interface AwaitingMetricStateProps {
  /** Single calm headline, e.g. "Risk scores will appear after the first snapshot." */
  message: string;
  /** Optional supporting line. */
  detail?: string;
  /** Optional discreet link (e.g. Proof Center). */
  link?: { label: string; href: string; ariaLabel?: string };
}

export function AwaitingMetricState({
  message,
  detail,
  link,
}: AwaitingMetricStateProps) {
  return (
    <div
      role="status"
      className="pf-empty-widget flex h-full flex-col items-center justify-center gap-1 px-5 py-8 text-center"
    >
      <p className="body-sm ct-text-muted">{message}</p>
      {detail ? <p className="body-xs ct-text-faint max-w-prose">{detail}</p> : null}
      {link ? (
        <Link
          href={link.href}
          aria-label={link.ariaLabel ?? link.label}
          className="body-xs ct-text-muted hover:ct-text-primary transition-colors underline underline-offset-2 decoration-(--ct-border) mt-1"
        >
          {link.label}
        </Link>
      ) : null}
    </div>
  );
}
