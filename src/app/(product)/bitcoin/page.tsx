import { redirect } from "next/navigation";

/** Alias route. /btc itself is now a redirect stub, so this points straight at
 *  the real destination instead of chaining two redirects. */
export default function BitcoinAliasPage() {
  redirect("/dashboard");
}
