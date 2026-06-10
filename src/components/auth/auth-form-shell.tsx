import type { ReactNode } from "react";

/**
 * Centered auth card — forgot / reset / TOTP. Cockpit glass tokens only.
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
    <div className="flex min-h-dvh items-center justify-center bg-[var(--ct-bg-deep)]">
      <div className="glass-panel-subtle w-full max-w-sm space-y-6 p-8">
        <div className="space-y-1">
          <h1 className="h1">{title}</h1>
          {description ? (
            <div className="body-xs ct-text-muted">{description}</div>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
