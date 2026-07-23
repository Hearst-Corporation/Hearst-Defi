// /bitcoin-constitution — the B2B doctrine surface for Series 1.
//
// Premium placeholder (PROMPT 027): static doctrine, no data reads, no fake
// KPI, no yield/APY/coupon/distribution language. It states what Series 1 IS,
// how the reserve is built, the buckets, the proof model, maturity logic, and
// — the strongest trust asset — what is proved vs. what is not. Enriched in a
// later pass; deliberately not overloaded here.

import {
  Series1Page,
  Series1PageTitle,
  Series1Section,
} from "@/components/series1-shell/Series1Page";
import {
  Series1Panel,
  Series1PanelHeader,
  Series1Row,
  Series1RowList,
} from "@/components/series1-shell/Series1Panel";

export const dynamic = "force-dynamic";

const BUCKETS = [
  {
    code: "B1",
    label: "Deployed mining capital",
    role: "Capital put to work in the mining strategy that produces the Bitcoin the reserve is built from.",
  },
  {
    code: "B2",
    label: "Bitcoin inventory",
    role: "The Bitcoin accumulated and held as reserve — the inventory the product exists to build, not a yield instrument.",
  },
  {
    code: "B3",
    label: "Operating reserve",
    role: "USDC held to cover operating and electricity cost, expressed as coverage months — never presented as income.",
  },
];

export default function BitcoinConstitutionPage() {
  return (
    <Series1Page>
      <Series1PageTitle
        title="Bitcoin Constitution"
        description="Not yield. Bitcoin inventory. Series 1 is a Bitcoin reserve constructed through a mining strategy and delivered at maturity — a B2B, proof-backed reserve, not a yield product."
        meta="Series 1 · doctrine"
      />

      <Series1Section
        index="01"
        title="What Series 1 is"
        description="A reserve construction and maturity-delivery product. Capital is deployed into a mining strategy; the Bitcoin it produces is accumulated as inventory and held as reserve until maturity. There is no APY, no coupon, no distribution — the return of the product is the Bitcoin inventory itself, proved on-chain."
      >
        <Series1Panel>
          <Series1PanelHeader
            title="Canonical framing"
            description="The one sentence every reader should leave with."
          />
          <div className="px-5 py-6">
            <p className="text-lg font-semibold tracking-tight text-(--ct-text-strong)">
              Not yield. Bitcoin inventory.
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-(--ct-text-muted)">
              Series 1 builds a Bitcoin reserve via a mining strategy and delivers
              it at maturity. It is measured in Bitcoin held and proved, never in
              a rate of return.
            </p>
          </div>
        </Series1Panel>
      </Series1Section>

      <Series1Section
        index="02"
        title="Buckets — B1 / B2 / B3"
        description="Capital is structured across three buckets. The policy target split is defined by the factsheet; the realised on-chain split is read from the vault when it is live."
      >
        <Series1Panel>
          <Series1RowList>
            {BUCKETS.map((bucket) => (
              <Series1Row
                key={bucket.code}
                label={`${bucket.code} · ${bucket.label}`}
                value=""
                hint={bucket.role}
              />
            ))}
          </Series1RowList>
        </Series1Panel>
      </Series1Section>

      <Series1Section
        index="03"
        title="Proof model"
        description="Every claim the product makes is backed by an on-chain event, indexed and shown in the Proof Center. Simulated or seed data is never rendered as investor-facing proof. Provenance (chain / fork / mainnet) and indexer freshness are shown honestly, including outages."
      >
        <Series1Panel>
          <Series1RowList>
            <Series1Row
              label="Source of truth"
              value="On-chain events"
              hint="Indexed DynaVault events — the single producer of history."
            />
            <Series1Row
              label="Never proof"
              value="Simulated · seed"
              hint="Preview / seed rows are never shown as real activity."
            />
            <Series1Row
              label="Provenance shown"
              value="Chain · freshness"
              hint="Fork vs. mainnet label and indexer freshness are always visible."
            />
          </Series1RowList>
        </Series1Panel>
      </Series1Section>

      <Series1Section
        index="04"
        title="Maturity logic"
        description="Series 1 has a defined product term. The reserve is built over that term and delivered at maturity. Any 'as of today' figure is a current state, never a promised final number."
      >
        <Series1Panel>
          <div className="px-5 py-6">
            <p className="max-w-2xl text-sm leading-6 text-(--ct-text-muted)">
              Progress toward maturity is expressed as reserve built to date
              against the product term — a floor that grows, not a guaranteed
              endpoint. No maturity has occurred yet.
            </p>
          </div>
        </Series1Panel>
      </Series1Section>

      <Series1Section
        index="05"
        title="What is proved · what is not"
        description="The absence of a figure is information the client is entitled to. These are stated plainly rather than papered over."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Series1Panel>
            <Series1PanelHeader title="Proved today" />
            <Series1RowList>
              <Series1Row label="Indexed on-chain events" value="Live" hint="Sorted by block, with provenance." />
              <Series1Row label="Allocation target vs. actual" value="Live" hint="On-chain drift when the vault answers." />
              <Series1Row label="Subscription eligibility" value="Live" hint="A contract fact, read on-chain." />
            </Series1RowList>
          </Series1Panel>
          <Series1Panel>
            <Series1PanelHeader title="Not proved yet" />
            <Series1RowList>
              <Series1Row label="Monthly BTC accumulation" value="Not available" hint="No indexer decode for the production series yet." />
              <Series1Row label="Mainnet events" value="Not available" hint="Today the chain is a fork (preprod), not mainnet." />
              <Series1Row label="Custody attestation" value="Not available" hint="Proof-of-reserve field exists, value not populated." />
            </Series1RowList>
          </Series1Panel>
        </div>
      </Series1Section>
    </Series1Page>
  );
}
