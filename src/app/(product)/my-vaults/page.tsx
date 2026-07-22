// /my-vaults — ABSORBED into My Position. Series 1 is a single product: a
// "held vaults" index over one vault duplicated the position surface.
// Redirect stub keeps existing links valid.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function MyVaultsPage() {
  redirect("/portfolio");
}
