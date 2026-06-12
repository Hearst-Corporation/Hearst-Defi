/**
 * AwaitingMetricState — light, self-contained empty surface for a widget whose
 * primary data is missing.
 *
 * Key principle: an empty widget must NOT look like an active card. So this is
 * NOT a `dash-cell dash-cell-premium` with a header + provenance badge + a
 * centered placeholder (which reads as a big black "placeholder box"). It is a
 * quiet, low surface — a single calm message, optionally a secondary detail and
 * one discreet link — that holds its grid slot without faking activity.
 *
 * No dash-cell-premium, no provenance badge, no dashed border, no nested
 * mini-surface. Just a calm note on a faint inset.
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
