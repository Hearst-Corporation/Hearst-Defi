// All product routes require auth data and live vault state — disable static prerendering.
export const dynamic = "force-dynamic";

import { headers } from "next/headers";

import { HubModeStyles } from "@/components/hub-mode-styles";
import { HeaderConnect } from "@/components/connect/header-connect";
import { InvestorRailIntra } from "@/components/nav/product-rail-intra";
import { requireInvestor } from "@/lib/auth/require-investor";

export default async function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolve the real destination path from the x-pathname header injected by
  // the edge proxy (src/proxy.ts). This enables a precise /login?from=<path>
  // redirect rather than falling back to a static "/portfolio".
  const h = await headers();
  const rawPathname = h.get("x-pathname") ?? "";
  // Sanitize: must be a non-empty relative path starting with "/". Any other
  // value (empty string, external URL leaking through somehow) falls back to
  // the safe default "/portfolio".
  const destination =
    rawPathname.startsWith("/") && rawPathname.length > 1
      ? rawPathname
      : "/portfolio";

  // Investor gate: no session → /login?from=<destination>. Admins are allowed
  // through (admin ⊇ investor) so they can review the product surfaces A→Z.
  const session = await requireInvestor(destination);

  return (
    <>
      <HubModeStyles />
      {/* Left rail — investor nav (Portfolio / Vaults / Profile).
          Admins additionally get an "Admin" entry to jump to their zone. */}
      <InvestorRailIntra isAdmin={session.role === "admin"} />
      {/* Identity slot — docked into the bottom of the left rail (Section 1).
          HeaderConnect renders only when Privy authenticated. */}
      <div className="connect-rail-identity">
        <HeaderConnect />
      </div>
      {children}
    </>
  );
}
