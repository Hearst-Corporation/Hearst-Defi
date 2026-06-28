import type { ReactNode } from "react";

import { Card } from "@/components/catalyst/card";

import "@/app/auth.css";

/**
 * Centered auth card — forgot / reset / TOTP. Cockpit glass tokens only.
 *
 * Wrapped in `.product-doc` for shared doc-flow layout; the heading scale is
 * pinned to the PORTFOLIO canon in auth.css (`.auth-shell .h1` — fixed H1,
 * 2xl H2, accent-green H3), so auth titles read identical to portfolio.
 */
export function AuthFormShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="product-doc auth-shell">
      <Card className="auth-card w-full max-w-sm" hoverOverlay={false}>
        <div className="auth-field">
          <h1 className="h1">{title}</h1>
          {description ? (
            <div className="body-xs ct-text-muted">{description}</div>
          ) : null}
        </div>
        {children}
      </Card>
    </div>
  );
}
