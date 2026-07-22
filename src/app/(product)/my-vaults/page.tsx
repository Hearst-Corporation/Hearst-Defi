import Link from "next/link";

import { Series1Page, Series1PageTitle } from "@/components/series1-shell/Series1Page";
import { Series1Panel } from "@/components/series1-shell/Series1Panel";

export const metadata = {
  title: "Vault",
  description: "The vaults you hold — performance, lock progress and accrued BTC.",
};

export default function MyVaultsPage() {
  return (
    <Series1Page>
      <Series1PageTitle
        title="Your Vaults"
        description="Series 1 positions you hold — deployed capital, accumulated Bitcoin and term progress."
        actions={
          <Link
            href="/vaults"
            className="inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-medium"
            style={{ background: "var(--s1-accent)", color: "#08130a" }}
          >
            View Series 1 →
          </Link>
        }
      />

      <Series1Panel className="p-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-medium">No vaults yet</p>
          <p className="max-w-sm text-xs leading-5" style={{ color: "var(--s1-muted)" }}>
            Once you subscribe to Series 1, your deployed capital, accumulated BTC and term progress appear here.
          </p>
          <Link href="/vaults" className="mt-2 text-sm font-medium" style={{ color: "var(--s1-accent)" }}>
            Explore Series 1 →
          </Link>
        </div>
      </Series1Panel>
    </Series1Page>
  );
}
