"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ConnectShell } from "@/components/ConnectShell";
import { AdminChatControls } from "@/components/admin/admin-chat-controls";

// Routes/prefixes that render WITHOUT the product chrome (left rail, bottom
// nav, cockpit chat). The sign-in screen must stand alone — no navigation into
// product surfaces is offered until the user is authenticated. Legal pages
// (/legal/*) use their own LegalLayout and must not get a double chrome.
const BARE_EXACT = new Set<string>([
  "/",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/totp-challenge",
]);
const BARE_PREFIXES = ["/legal"] as const;

function isBareRoute(pathname: string): boolean {
  if (BARE_EXACT.has(pathname)) return true;
  return BARE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Decides whether to wrap children in the full Cockpit shell or render them
 * bare. The shell (rail + chat + bottom nav) is for authenticated product
 * surfaces; the auth screens opt out so nothing leaks before sign-in.
 */
export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bare = isBareRoute(pathname);

  if (bare) {
    return <div className="min-h-dvh bg-[var(--ct-bg-deep)]">{children}</div>;
  }

  // The conversational Master Agent is available on every authenticated product
  // surface — LP investors and admins alike. Bare auth/legal routes already
  // returned above, so they never get the chat. Server-side guardrails (no
  // client system override, output-side compliance guard, role-aware register)
  // make this LP-facing surface safe.
  return (
    <ConnectShell enableChat>
      {children}
      {/* Chat mode selector (Conversation / Review). Self-gates to admins via
          the requireAdmin-protected /api/admin/review-mode route; renders
          nothing for everyone else. Mounted here so it's available on every
          product page, not just /admin. */}
      <AdminChatControls />
    </ConnectShell>
  );
}
