import type { Metadata } from "next";
import "./tokens-layer.css";
import "./globals.css";
import "./cockpit.css";

import { AppChrome } from "@/components/app-chrome";
import { Analytics } from "@/components/analytics";
import { PrivyProvider } from "@/components/auth/privy-provider";
import { ClientToaster } from "@/components/ui/client-toaster";
import { PRIVY_APP_ID } from "@/lib/auth/privy-config";
import { isDevAuthBypass } from "@/lib/dev-bypass";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

export const metadata: Metadata = {
  title: { default: "Hearst Connect", template: "%s | Hearst Connect" },
  description:
    "Hearst Mining Note — an institutional Bitcoin accumulation instrument backed by real Bitcoin mining. BTC accumulates over a 24-month term and is delivered at maturity; estimated outcomes are disclosed as a range, not guaranteed.",
  metadataBase: new URL("https://connect.hearst.app"),
  openGraph: {
    type: "website",
    siteName: "Hearst Connect",
    title: "Hearst Connect — Institutional Bitcoin Accumulation Note",
    description:
      "Backed by real Bitcoin mining. BTC accumulates over a 24-month term and is delivered at maturity — no periodic cash distribution, no fixed APY. Estimated outcomes are disclosed as a range, not guaranteed.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hearst Connect — Bitcoin Accumulation Note",
    description:
      "Institutional Bitcoin accumulation instrument backed by real Bitcoin mining.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* Skip-link — MUST be the first focusable element in the DOM so the
            very first Tab reaches it (a11y / QA P2). Hoisted OUT of <AppChrome>:
            inside it, the Cockpit shell renders its left rail + buttons before
            the children slot, pushing this link to ~3rd in focus order. It
            targets #main-content, which can live anywhere in the document. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[var(--ct-z-overlay)] focus:rounded-lg focus:bg-[var(--ct-accent)] focus:px-[var(--ct-space-4)] focus:py-[var(--ct-space-2)] focus:ct-text-on-accent"
        >
          Skip to main content
        </a>
        <AppChrome masterAgentEnabled={FEATURE_FLAGS.CHAT_MASTER_AGENT}>
          <PrivyProvider appId={isDevAuthBypass() ? "" : PRIVY_APP_ID}>
            <main id="main-content">{children}</main>
            <ClientToaster />
          </PrivyProvider>
          <Analytics />
        </AppChrome>
      </body>
    </html>
  );
}
