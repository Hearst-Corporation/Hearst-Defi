// /btc — ABSORBED into the Overview. The Bitcoin Reserve read (accumulation,
// reserve runway, custody) is part of the five-surface investor nav, not a
// destination of its own. Redirect stub so a bookmarked or agent-issued link
// still lands somewhere true instead of 404-ing.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function BtcPage() {
  redirect("/dashboard");
}
