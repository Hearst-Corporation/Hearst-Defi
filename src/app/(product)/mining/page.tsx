// /mining — ABSORBED into the Overview. Fleet state, hashrate and electricity
// are operational reads that belong beside the vault they fund, not on a
// separate investor destination. Redirect stub keeps existing links valid.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function MiningPage() {
  redirect("/dashboard");
}
