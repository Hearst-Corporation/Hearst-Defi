/**
 * error-shell.tsx — Shared error/not-found layout shell.
 *
 * `ErrorShellLayout` is the single H1/eyebrow pattern for every error surface:
 * segment `error.tsx`, `not-found`, and `global-error` (which imports the Cockpit
 * CSS stack in its own `<html>` because the root layout is replaced).
 */

import type React from "react";

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
  const eyebrowColor =
    tone === "danger"
      ? "ct-status-danger"
      : "ct-status-warning";

  return (
    <div
      className={cn(
        "glass-panel",
        "mx-auto my-10 max-w-2xl p-8",
        "flex flex-col gap-5",
      )}
      role={tone === "danger" ? "alert" : "status"}
      aria-live={tone === "danger" ? "assertive" : "polite"}
    >
      <header className="flex flex-col gap-2">
        <span className={cn("eyebrow", eyebrowColor)}>{scope}</span>
        <h1 className="h1 m-0">{title}</h1>
      </header>

      {message ? (
        <p className="body-md m-0 text-sm leading-normal ct-text-body">
          {message}
        </p>
      ) : null}

      {errorMessage ? (
        <pre
          className={cn(
            "mono",
            "rounded-md",
            "border border-[var(--ct-border)]",
            "ct-surface-1",
            "ct-text-primary",
            "overflow-auto",
            "whitespace-pre-wrap break-words",
            "max-h-64 px-4 py-4 text-xs leading-normal",
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
    </div>
  );
}

