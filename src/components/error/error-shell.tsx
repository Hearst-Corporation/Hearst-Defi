/**
 * error-shell.tsx — Shared error/not-found layout shell.
 *
 * `ErrorShellLayout` is the single H1/eyebrow pattern for segment `error.tsx`
 * and `not-found` surfaces (global-error is self-contained and does not use
 * this shell). Runtime honesty: only classes/tokens that actually resolve
 * under the loaded CSS (app.css → theme/legacy-bridge/typography) are used —
 * the former `error-shell__*` and `.ct-status-*` classes lived only in
 * cockpit.css (Storybook) and silently did nothing at runtime.
 */

import type React from "react";

import { Card } from "@/components/catalyst/card";
import { cn } from "@/lib/cn";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ErrorShellLayoutProps {
  /** Eyebrow label colour: "danger" | "warning" */
  tone?: "danger" | "warning";
  /** Eyebrow label text, e.g. "Dashboard · Error" */
  scope: string;
  title: string;
  /** Optional body copy */
  message?: string;
  /** Optional error digest for support correlation */
  digest?: string;
  /** Optional raw error message shown in <pre> */
  errorMessage?: string;
  /** Action buttons / links rendered in the footer row */
  actions: React.ReactNode;
}

// ── Layout variant (under Cockpit shell, CSS vars available) ──────────────────

export function ErrorShellLayout({
  tone = "danger",
  scope,
  title,
  message,
  digest,
  errorMessage,
  actions,
}: ErrorShellLayoutProps) {
  return (
    <Card
      className="mx-auto my-10 flex max-w-2xl flex-col gap-5 p-10"
      hoverOverlay={false}
      role={tone === "danger" ? "alert" : "status"}
      aria-live={tone === "danger" ? "assertive" : "polite"}
    >
      <header className="flex flex-col gap-2">
        {/* hc-eyebrow (@layer components) + a colour utility: utilities win
            the cascade, unlike the un-layered `.eyebrow` whose colour cannot
            be overridden by a class. */}
        <span
          className={cn(
            "hc-eyebrow",
            tone === "danger" ? "text-danger" : "text-warning",
          )}
        >
          {scope}
        </span>
        <h1 className="h1 m-0">{title}</h1>
      </header>

      {message ? (
        <p className="body-md m-0 ct-text-body">
          {message}
        </p>
      ) : null}

      {errorMessage ? (
        <pre
          className={cn(
            "mono",
            "rounded-md",
            "border border-[var(--ct-border)]",
            "bg-transparent",
            "ct-text-primary",
            "overflow-auto",
            "whitespace-pre-wrap break-words",
            "max-h-64 px-4 py-4 body-xs leading-normal",
          )}
        >
          {errorMessage}
        </pre>
      ) : null}

      {digest ? (
        <p className="body-xs m-0 ct-text-muted">
          Error ID:&nbsp;<span className="mono">{digest}</span>
        </p>
      ) : null}

      <div className="mt-1 flex flex-wrap items-center gap-3">{actions}</div>
    </Card>
  );
}

