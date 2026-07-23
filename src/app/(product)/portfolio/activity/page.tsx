// Portfolio › Activity — CONSOLIDATED into /portfolio (PROMPT 028). The
// contribution timeline (RecentActivity on the real loadPortfolio ledger) now
// lives inside the unified Portfolio page as section 02, so this standalone
// leaf no longer has its own object. Kept as a redirect stub so the exhaustive
// route test (product-routes.test.ts) and the nav / LLM whitelists stay valid,
// while a stray visitor lands on the canonical Portfolio console.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ActivityPage() {
  redirect("/portfolio");
}
