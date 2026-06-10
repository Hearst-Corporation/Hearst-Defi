/**
 * error-shell.tsx — Shared error/not-found layout shell.
 *
 * Two variants:
 *   - "layout"     : pages rendered inside the Cockpit shell (CSS vars available).
 *                    Uses Tailwind utility classes; zero inline magic numbers.
 *   - "standalone" : pages that own their own <html><body> (global-error, not-found).
 *                    CSS vars are NOT guaranteed, so colours are supplied as inline
 *                    styles via CT_CHROME / CT_PRODUCT_CONNECT_HEX from cockpit-tokens.
 *                    Magic spacing/typo are factored into named constants here so they
 *                    are never duplicated across the two standalone pages.
 *
 * NOTE: CT_CHROME does not expose a `textDim` value (it is a minimal hex mirror).
 * The standalone pages therefore use CT_CHROME.textPrimary for secondary text as well.
 * When CT_CHROME.textDim is added to cockpit-tokens.ts, update STANDALONE_STYLES.textDim.
 */

import type React from "react";

import Link from "next/link";

import {
  CT_CHROME,
  CT_PRODUCT_CONNECT_FG_HEX,
  CT_PRODUCT_CONNECT_HEX,
} from "@/lib/cockpit-tokens";
import { cn } from "@/lib/cn";

// ── Standalone style constants (no CSS vars) ──────────────────────────────────
// All spacing/typo values sourced from the canonical scale:
//   container  : max-width 42rem, padding 2rem, margin 2.5rem auto
//   title      : 1.5rem / semibold / leading-tight
//   body       : 0.875rem / normal / leading-normal
//   button     : padding 0.5rem 1rem, border-radius 9999px, 0.875rem / medium
//   pre block  : padding 0.875rem 1rem, max-height 16rem, 0.8125rem
// These constants are intentionally declared once to avoid duplicating magic
// numbers across both standalone page files.

const SA = {
  container: {
    textAlign: "center" as const,
    maxWidth: "42rem",
    padding: "2rem",
    margin: "2.5rem auto",
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: 600,
    lineHeight: 1.25,
    marginBottom: "0.5rem",
    color: CT_CHROME.textPrimary,
  },
  body: {
    fontSize: "0.875rem",
    fontWeight: 400,
    lineHeight: 1.5,
    marginBottom: "1rem",
    // textDim not yet in CT_CHROME — using textPrimary at reduced opacity
    color: CT_CHROME.textPrimary,
    opacity: 0.7,
  },
  digest: {
    fontSize: "0.75rem",
    lineHeight: 1.5,
    color: CT_CHROME.textPrimary,
    opacity: 0.5,
    marginBottom: "1.5rem",
  },
  button: {
    display: "inline-block",
    padding: "0.5rem 1rem",
    background: CT_PRODUCT_CONNECT_HEX,
    color: CT_PRODUCT_CONNECT_FG_HEX,
    border: "none",
    borderRadius: "9999px",
    cursor: "pointer",
    fontSize: "0.875rem",
    fontWeight: 500,
    textDecoration: "none",
  } as React.CSSProperties,
  body_html: {
    margin: 0,
    background: CT_CHROME.bgDeep,
    color: CT_CHROME.textPrimary,
    fontFamily: '"Satoshi Variable", sans-serif',
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
  } as React.CSSProperties,
} as const;

// ── Re-export constants for standalone pages ──────────────────────────────────
export { SA as STANDALONE_STYLES };

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
            "max-h-64 px-4 py-3.5 text-xs leading-normal",
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

// ── Standalone back-link (used by not-found.tsx) ──────────────────────────────

export function StandaloneBackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link href={href} style={SA.button}>
      {label}
    </Link>
  );
}

// ── Standalone reset-button (used by global-error.tsx) ────────────────────────

export function StandaloneResetButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button onClick={onClick} style={SA.button}>
      {label}
    </button>
  );
}

