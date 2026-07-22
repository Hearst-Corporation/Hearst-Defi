"use client";

import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

import { ConnectShell } from "@/components/ConnectShell";
import { AppFooter } from "@/components/app-footer";

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
// /apply renders standalone: the qualification chamber carries its own inline
// assistant panel (ApplyAssistantPanel), so it must NOT get the Cockpit chat
// rail. /legal/* uses its own LegalLayout.
// NOTE: /preview is deliberately NOT bare — the shell previews exist to show
// the real KYC application shell (sidebar, header, drawer, assistant dock),
// so they must render inside ConnectShell like every product surface.
const BARE_PREFIXES = ["/legal", "/apply"] as const;

function isBareRoute(pathname: string): boolean {
  if (BARE_EXACT.has(pathname)) return true;
  return BARE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Bare routes that still carry the full institutional footer (the public-facing
// "socle plein"): every legal page (/legal/*). The home screen "/" is the wallet
// sign-in (split-screen login) — an auth funnel, so it stays footer-free like
// /login: the full plinth otherwise flashed in at the top before the login
// surface mounted, then vanished.
function isFooterBareRoute(pathname: string): boolean {
  return pathname === "/legal" || pathname.startsWith("/legal/");
}

/**
 * Auth routes stay bare. Every authenticated route uses the KYC-pattern
 * application shell: readable sidebar, responsive drawer and a non-blocking
 * assistant dock rather than the retired three-panel cockpit.
 */
export function AppChrome({
  children,
  // Resolved server-side from the CHAT_MASTER_AGENT flag (server-only env). When
  // OFF, the navigation bridge must NOT mount: publishNav is never called, so
  // polling /api/chat-nav every few seconds for 100% of authenticated users
  // would be pure wasted load.
  masterAgentEnabled: _masterAgentEnabled = false,
}: {
  children: ReactNode;
  masterAgentEnabled?: boolean;
}) {
  const pathname = usePathname();
  const bare = isBareRoute(pathname);

  if (bare) {
    return (
      <div className="min-h-dvh bg-(--ct-bg-deep)">
        {children}
        {/* Public surfaces ("/" and /legal/*) carry the full institutional
            footer; auth funnels stay footer-free. */}
        {isFooterBareRoute(pathname) ? <AppFooter variant="full" /> : null}
      </div>
    );
  }

  return (
    <ConnectShell>
      {children}
    </ConnectShell>
  );
}
