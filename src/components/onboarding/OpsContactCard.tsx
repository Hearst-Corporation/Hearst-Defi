/**
 * OpsContactCard — named Investor Relations representative card.
 *
 * Displays the IR contact (name, title, email) and a Calendly stub link.
 * No external deps — pure display component.
 * Cockpit tokens only.
 */

import { Card } from "@/components/ui/card";

interface OpsContactCardProps {
  name?: string;
  title?: string;
  email?: string;
  /** Calendly booking link — stub by default. */
  calendlyHref?: string;
}

export function OpsContactCard({
  name = "Sarah Chen",
  title = "Investor Relations",
  email = "sarah@hearstconnect.io",
  calendlyHref = "https://calendly.com/hearstconnect/15min",
}: OpsContactCardProps) {
  return (
    <Card
      className="w-full flex flex-col gap-3"
      role="complementary"
      aria-label="Investor Relations contact"
    >
      <span className="eyebrow ct-text-muted">Your IR Contact</span>

      <div className="flex items-center gap-3">
        {/* Avatar placeholder */}
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--ct-accent-soft)] border border-[var(--ct-border-accent)] shrink-0 ct-text-accent font-semibold text-sm"
        >
          {name.charAt(0)}
        </span>

        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-semibold ct-text-strong truncate tracking-tight">
            {name}
          </span>
          <span className="body-xs ct-text-muted truncate">{title}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {/* Email link */}
        <a
          href={`mailto:${email}`}
          className="body-xs text-[var(--ct-accent-strong)] no-underline hover:underline truncate transition-opacity hover:opacity-80"
          aria-label={`Email ${name} at ${email}`}
        >
          {email}
        </a>

        {/* Calendly CTA */}
        <a
          href={calendlyHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 body-xs text-[var(--ct-accent-strong)] no-underline hover:underline transition-opacity hover:opacity-80"
          aria-label={`Book a 15-minute call with ${name} (opens in new tab)`}
        >
          Book 15-min call ↗
        </a>
      </div>
    </Card>
  );
}
