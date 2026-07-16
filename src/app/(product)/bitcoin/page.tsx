import { redirect } from "next/navigation";

/** Alias route — nav label is "Bitcoin", canonical path is /btc. */
export default function BitcoinAliasPage() {
  redirect("/btc");
}
