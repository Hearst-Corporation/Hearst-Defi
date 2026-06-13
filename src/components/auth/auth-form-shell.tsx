import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

/**
 * Centered auth card — forgot / reset / TOTP. Cockpit glass tokens only.
 *
 * ADR-013: wrapped in `.product-doc` so `.h1` matches doc-flow scale (2xl/700)
 * instead of the global cockpit hero (3xl/800). Auth routes sit outside the
 * product layout but intentionally share document-flow typography.
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
    <div className="product-doc flex min-h-dvh items-center justify-center bg-[var(--ct-bg-deep)]">
      <Card className="w-full max-w-sm flex flex-col gap-6 p-8" hoverOverlay={false}>
        <div className="flex flex-col gap-1">
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
