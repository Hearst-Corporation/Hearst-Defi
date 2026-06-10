import type { Metadata } from "next";
import "./tokens-layer.css";
import "./globals.css";
import "./cockpit.css";

import { AppChrome } from "@/components/app-chrome";
import { Analytics } from "@/components/analytics";
import { PrivyProvider } from "@/components/auth/privy-provider";
import { ClientToaster } from "@/components/ui/client-toaster";
import { PRIVY_APP_ID } from "@/lib/auth/privy-config";

export const metadata: Metadata = {
  title: { default: "Hearst Connect", template: "%s | Hearst Connect" },
  description:
    "Institutional RWA yield vault backed by Bitcoin mining cash flows — monthly USDC distributions, capital held in reserve.",
  metadataBase: new URL("https://connect.hearst.app"),
  openGraph: {
    type: "website",
    siteName: "Hearst Connect",
    title: "Hearst Connect — Institutional RWA Yield Vault",
    description:
      "RWA yield backed by Bitcoin mining cash flows. Monthly USDC distributions, principal held in a USDC reserve. Target net range 8–15%.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hearst Connect — RWA Yield Vault",
    description:
      "Institutional RWA yield vault backed by Bitcoin mining cash flows.",
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
    <html lang="en" data-rail-mode="collapsed" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* Skip-link — MUST be the first focusable element in the DOM so the
            very first Tab reaches it (a11y / QA P2). Hoisted OUT of <AppChrome>:
            inside it, the Cockpit shell renders its left rail + buttons before
            the children slot, pushing this link to ~3rd in focus order. It
            targets #main-content, which can live anywhere in the document. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[var(--ct-z-overlay)] focus:rounded-[var(--ct-radius-lg)] focus:bg-[var(--ct-accent)] focus:px-4 focus:py-2 focus:text-[var(--ct-bg-deep)]"
        >
          Skip to main content
        </a>
        <AppChrome>
          <PrivyProvider appId={PRIVY_APP_ID}>
            <main id="main-content">{children}</main>
            <ClientToaster />
          </PrivyProvider>
          <Analytics />
        </AppChrome>
      </body>
    </html>
  );
}
