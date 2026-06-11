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

  // Chat is only enabled in the admin zone — LP surfaces have no chat UI.
  const isAdmin = pathname.startsWith("/admin");

  return (
    <ConnectShell enableChat={isAdmin}>
      {children}
      {/* Chat mode selector (Conversation / Review). Self-gates to admins via
          the requireAdmin-protected /api/admin/review-mode route; renders
          nothing for everyone else. Mounted here so it's available on every
          product page, not just /admin. */}
      <AdminChatControls />
    </ConnectShell>
  );
}
