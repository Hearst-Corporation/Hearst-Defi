import Link from "next/link";

import { Series1Allocation } from "@/components/series1-shell/Series1Allocation";
import { Series1KpiBand } from "@/components/series1-shell/Series1KpiBand";
import { Series1Page, Series1PageTitle, Series1Section } from "@/components/series1-shell/Series1Page";
import { Series1Panel, Series1PanelHeader, Series1Row, Series1RowList } from "@/components/series1-shell/Series1Panel";
import { Series1Timeline } from "@/components/series1-shell/Series1Timeline";

export const metadata = {
  title: "Reserve Vault · Hearst Bitcoin Reserve Vault — Series 1",
  description: "BTC-accumulation instrument backed by real Bitcoin mining, delivered at maturity.",
};

export default function VaultsPage() {
  return (
    <Series1Page>
      <Series1PageTitle
        title="Hearst Bitcoin Reserve Vault — Series 1"
        meta="Methodology v3.0"
        description="BTC-accumulation instrument backed by real Bitcoin mining, structured across three on-chain pockets and delivered at maturity."
        actions={
          <Link
            href="/proof-center"
            className="inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-medium"
            style={{ background: "var(--s1-accent)", color: "#08130a" }}
          >
            View proof status
          </Link>
        }
      />

      <Series1KpiBand
        hero={{
          label: "Vault status",
          value: "Not yet open",
          hint: "Subscriptions require completed onboarding.",
        }}
        metrics={[
          { label: "B1 Mining Power", value: "40%", hint: "Target allocation" },
          { label: "B2 BTC Reserve", value: "27%", hint: "Target allocation" },
          { label: "B3 Operating Reserve", value: "33%", hint: "Target allocation" },
          { label: "Capital deployed", value: "—", hint: "Pending first settlement" },
          { label: "Term", value: "24 months", hint: "BTC delivered at maturity" },
          { label: "Minimum ticket", value: "$250k", hint: "60-day soft lock-up" },
        ]}
      />

      <Series1Section
        index="01"
        title="Allocation"
        description="Capital is structured across three on-chain pockets. Figures are the product target split; the realised split is not yet indexed on-chain."
      >
        <Series1Panel>
          <Series1Allocation />
        </Series1Panel>
      </Series1Section>

      <Series1Section
        index="02"
        title="Reserve construction path"
        description="How mining production converts into the Bitcoin reserve delivered at maturity."
      >
        <Series1Panel>
          <div className="p-5">
            <Series1Timeline
              steps={[
                { label: "Capital deployed", detail: "Subscriptions are allocated across B1 / B2 / B3 at the target split." },
                { label: "Mining production", detail: "B1 hashrate produces Bitcoin; electricity and operations are funded from B3." },
                { label: "Reserve accumulation", detail: "Produced Bitcoin accumulates in B2. The reserve is built from mining production only." },
                { label: "Delivery at maturity", detail: "The accumulated Bitcoin reserve is delivered in BTC at the end of the term." },
              ]}
            />
          </div>
        </Series1Panel>
      </Series1Section>

      <Series1Section index="03" title="Structure">
        <div className="grid gap-5 lg:grid-cols-2">
          <Series1Panel>
            <Series1PanelHeader title="Smart contract & share receipt" />
            <Series1RowList>
              <Series1Row label="Share class" value="—" />
              <Series1Row label="SPV jurisdiction" value="Cayman" />
              <Series1Row label="Proof status" value="Proof Center" hint="Attestations and on-chain evidence" />
            </Series1RowList>
          </Series1Panel>

          <Series1Panel>
            <Series1PanelHeader title="Maturity & BTC delivery" />
            <Series1RowList>
              <Series1Row label="Term" value="24 months" hint="From subscription settlement" />
              <Series1Row label="Delivered in" value="BTC" hint="Accumulated reserve, at maturity" />
              <Series1Row label="Periodic distribution" value="None" hint="The note pays no periodic cash and carries no fixed rate." />
              <Series1Row label="Soft lock-up" value="60 days" hint="Contractual, not enforced on-chain" />
            </Series1RowList>
          </Series1Panel>
        </div>
      </Series1Section>

      <p className="text-xs leading-5" style={{ color: "var(--s1-muted)" }}>
        The note carries no fixed rate and no guaranteed return. Estimated outcomes are disclosed as a range and are not guaranteed.
      </p>
    </Series1Page>
  );
}
