// /dashboard — RETIRED as the investor home (MONDE B, 2026-07-25).
//
// Decision: the single investor accueil is "My Position" (/portfolio), sourced
// from the backend. The old fund-level overview is NO LONGER the landing — a
// logged-in investor lands on their own position, not on a fund console. The
// dormant fund-dashboard code (the series1-dashboard component tree and its
// loader) has been DELETED; only this redirect stub remains.
//
// Kept as a redirect stub so existing links, the exhaustive route test
// (product-routes.test.ts) and the nav / LLM whitelists stay valid, while a
// stray visitor lands on the canonical home.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  redirect("/portfolio");
}
