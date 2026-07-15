// Portfolio › Yield — RETIRED. The old "accrued / YTD yield" + 4-sleeve
// allocation view described a distribution product that no longer exists. v2 is
// a BTC-accumulation mining note (3 pockets, 24-month term, rule-based
// take-profit); accumulation is tracked on the portfolio console, not as a paid
// yield. Redirect stub kept so the exhaustive route test (product-routes.test.ts)
// and the nav / LLM whitelists stay valid.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function YieldPage() {
  redirect("/portfolio");
}
