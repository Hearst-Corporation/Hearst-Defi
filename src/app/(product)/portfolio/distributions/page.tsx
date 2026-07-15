// Portfolio › Distributions — RETIRED. The v2 product (PermissionedDynaVault,
// a mining note) has NO periodic cash distribution: capital accumulates BTC over
// a 24-month term with rule-based take-profit, delivered at maturity. This route
// no longer has an object; it redirects to the portfolio console. Kept as a
// redirect stub so the exhaustive route test (product-routes.test.ts) and the
// nav / LLM whitelists stay valid, while a stray visitor lands on the canonical
// vault-health surface instead of a distributions ledger that no longer exists.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DistributionsPage() {
  redirect("/portfolio");
}
