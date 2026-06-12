/**
 * OpsContactCard — Investor Relations representative (env-configured data only).
 */

import { Card } from "@/components/ui/card";

interface OpsContactCardProps {
  name: string;
  title: string;
  email: string;
  calendlyHref: string;
}

export function OpsContactCard({
  name,
  title,
  email,
  calendlyHref,
}: OpsContactCardProps) {
  return (
    <Card
      className="w-full product-doc-stack--actions"
      role="complementary"
      aria-label="Investor Relations contact"
    >
      <span className="eyebrow ct-text-muted">Your IR contact</span>

      <div className="product-doc-inline-row product-doc-inline-row--loose">
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center w-10 h-10 rounded-full ct-status-success-bg shrink-0 ct-text-accent body-sm font-semibold"
        >
          {name.charAt(0)}
        </span>

        <div className="product-doc-stack--compact min-w-0">
          <span className="body-sm ct-text-strong truncate font-semibold tracking-tight">
            {name}
          </span>
          <span className="body-xs ct-text-muted truncate">{title}</span>
        </div>
      </div>

      <div className="product-doc-stack--tight">
        <a
          href={`mailto:${email}`}
          className="body-xs ct-link-accent truncate hover:underline"
          aria-label={`Email ${name} at ${email}`}
        >
          {email}
        </a>

        <a
          href={calendlyHref}
          target="_blank"
          rel="noopener noreferrer"
          className="product-doc-inline-row product-doc-inline-row--dense body-xs ct-link-accent hover:underline"
          aria-label={`Book a call with ${name} (opens in new tab)`}
        >
          Book a call ↗
        </a>
      </div>
    </Card>
  );
}
