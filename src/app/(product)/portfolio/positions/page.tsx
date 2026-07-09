// Portfolio › Positions — DE-DUPLICATED. The held-positions table lives at
// /my-vaults (the rail "Vault" entry); this route previously rendered a second,
// near-identical positions table (orphaned, linked from nowhere). Kept as a
// redirect stub so the exhaustive route test (product-routes.test.ts) and the
// nav/LLM whitelists stay valid, while a stray visitor lands on the canonical
// held-positions surface instead of a duplicate.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function PositionsPage() {
  redirect("/my-vaults");
}
