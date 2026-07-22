// All product routes require auth data and live vault state — disable static prerendering.
export const dynamic = "force-dynamic";

import { headers } from "next/headers";

import { requireInvestor } from "@/lib/auth/require-investor";

export default async function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolve the real destination path from the x-pathname header injected by
  // the edge proxy (src/proxy.ts). This enables a precise /login?from=<path>
  // redirect rather than falling back to a static "/dashboard".
  const h = await headers();
  const rawPathname = h.get("x-pathname") ?? "";
  // Sanitize: must be a non-empty relative path starting with "/". Any other
  // value (empty string, external URL leaking through somehow) falls back to
  // the safe default "/dashboard" (UI V2 investor entry point).
  const destination =
    rawPathname.startsWith("/") && rawPathname.length > 1
      ? rawPathname
      : "/dashboard";

  // Investor gate: no session → /login?from=<destination>. Admins are allowed
  // through (admin ⊇ investor) so they can review the product surfaces A→Z.
  await requireInvestor(destination);

  return children;
}
