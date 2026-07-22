// /btc/ledger — ABSORBED into the Proof Center. The BTC movement register is
// evidence, and evidence lives on one surface. Redirect stub so an existing
// link resolves to the surface that now carries the register.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function BtcLedgerPage() {
  redirect("/proof-center");
}
