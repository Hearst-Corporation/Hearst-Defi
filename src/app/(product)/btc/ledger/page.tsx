import Link from "next/link";

import { Series1Page, Series1PageTitle, Series1Section } from "@/components/series1-shell/Series1Page";
import { Series1Panel, Series1PanelHeader, Series1Row, Series1RowList } from "@/components/series1-shell/Series1Panel";

export const metadata = {
  title: "Bitcoin ledger · Hearst Connect",
  description: "Full register of BTC movements and attestations, with maturity delivery terms",
};

export default function BtcLedgerPage() {
  return (
    <Series1Page>
      <div className="flex flex-col gap-1">
        <Link href="/btc" className="self-start text-xs font-medium" style={{ color: "var(--s1-accent)" }}>
          ← Back to Bitcoin Reserve
        </Link>
        <Series1PageTitle
          title="Bitcoin ledger"
          description="Full register of every movement that changed the BTC balance, with attestations and delivery terms."
        />
      </div>

      <Series1Section index="01" title="Reserve ledger" description="Accumulation events become visible after they are indexed from mining operations.">
        <Series1Panel>
          <Series1PanelHeader title="Accumulation events" description="No events have been indexed for the current reporting window." />
          <div className="flex min-h-40 flex-col items-center justify-center gap-1 px-6 py-10 text-center">
            <p className="text-sm font-medium">Ledger is not available yet</p>
            <p className="max-w-sm text-xs leading-5" style={{ color: "var(--s1-muted)" }}>
              Movements will appear here once the Bitcoin reserve ledger has indexed events, with running balance and attestation hashes.
            </p>
          </div>
        </Series1Panel>
      </Series1Section>

      <Series1Section index="02" title="Maturity delivery" description="Delivery terms for the current Series 1 term.">
        <Series1Panel>
          <Series1PanelHeader title="Delivery terms" />
          <Series1RowList>
            <Series1Row label="Term progress" value="—" hint="Months elapsed of 24" />
            <Series1Row label="Custody evidence" value="Awaiting" />
            <Series1Row label="Delivery" value="At maturity" />
          </Series1RowList>
        </Series1Panel>
      </Series1Section>

      <p className="px-1 text-xs leading-5" style={{ color: "var(--s1-muted)" }}>
        Accumulated BTC is delivered at maturity — not guaranteed.
      </p>
    </Series1Page>
  );
}
