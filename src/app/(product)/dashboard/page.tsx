import { Series1Allocation } from "@/components/series1-shell/Series1Allocation";
import { Series1ChartPlaceholder } from "@/components/series1-shell/Series1ChartPlaceholder";
import { Series1KpiBand } from "@/components/series1-shell/Series1KpiBand";
import { Series1Page, Series1PageTitle, Series1Section } from "@/components/series1-shell/Series1Page";
import { Series1Panel, Series1PanelHeader, Series1Row, Series1RowList } from "@/components/series1-shell/Series1Panel";
import { Series1Timeline } from "@/components/series1-shell/Series1Timeline";

export const metadata = {
  title: "Overview · Hearst Bitcoin Reserve Vault — Series 1",
};

export default function DashboardPage() {
  return (
    <Series1Page>
      <Series1PageTitle
        title="Reserve Vault Overview"
        meta="Methodology v3.0"
        description="A single investor register for capital deployment, accumulated Bitcoin, reserve coverage, mining operations and proof readiness."
      />

      <Series1KpiBand
        hero={{
          label: "Position status",
          value: "No active position",
          hint: "Subscribe to begin tracked Bitcoin accumulation",
        }}
        metrics={[
          { label: "Capital deployed", value: "—", hint: "No subscription recorded" },
          { label: "Reserve runway", value: "—", hint: "B3 Reserve USDC coverage" },
          { label: "Mining state", value: "—", hint: "Current reporting window" },
          { label: "Term progress", value: "—", hint: "Months elapsed of 24" },
          { label: "Contract", value: "Pending", hint: "Deployment state" },
          { label: "Proof status", value: "Awaiting", hint: "Source provenance below" },
        ]}
      />

      <Series1Section
        index="01"
        title="Bitcoin accumulation"
        description="Accumulated BTC is the principal investor outcome. Market price is contextual only; it is not a return projection."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <Series1ChartPlaceholder
            className="lg:col-span-8"
            title="Accumulated BTC through the term"
            description="Mining credits indexed from the program ledger."
            status="configured"
            label="Accumulation history is not available yet"
            detail="The chart will populate after mining credits are indexed in the Bitcoin reserve ledger."
          />
          <Series1Panel className="lg:col-span-4">
            <Series1PanelHeader title="Position summary" />
            <Series1RowList>
              <Series1Row label="DCA discipline" value="—" />
              <Series1Row label="Reserve management" value="—" />
              <Series1Row label="Execution quality" value="—" />
              <Series1Row label="Accumulation pace" value="—" />
            </Series1RowList>
            <p className="px-5 py-4 text-xs leading-5" style={{ color: "var(--s1-muted)" }}>
              Signals populate as the position and underlying reports resolve.
            </p>
          </Series1Panel>
        </div>
      </Series1Section>

      <Series1Section
        index="02"
        title="Capital architecture"
        description="Capital is governed by the Series 1 policy allocation: B1 Mining Power, B2 BTC Reserve and B3 Operating Reserve."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <Series1Panel className="lg:col-span-7">
            <Series1PanelHeader title="Policy allocation" />
            <Series1Allocation />
          </Series1Panel>
          <Series1Panel className="lg:col-span-5">
            <Series1PanelHeader title="Capital flow" />
            <div className="p-5">
              <Series1Timeline
                steps={[
                  { label: "USDC subscription", state: "upcoming" },
                  { label: "B1 / B2 / B3 allocation", state: "upcoming" },
                  { label: "BTC reserve ledger", state: "upcoming" },
                  { label: "BTC delivery at maturity", state: "upcoming" },
                ]}
              />
            </div>
          </Series1Panel>
        </div>
      </Series1Section>

      <Series1Section
        index="03"
        title="Operations, reserve & proof"
        description="Operational reports are kept separate from the investor outcome so every number retains its source and meaning."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Series1ChartPlaceholder
            title="All-in acquisition cost vs BTC spot"
            status="configured"
            label="Cost history is not available yet"
            detail="A comparison becomes available when cost and spot observations have both resolved."
          />
          <Series1ChartPlaceholder
            title="Reserve runway"
            description="Electricity coverage funded by B3 Reserve USDC."
            status="configured"
            label="Reserve runway is not available yet"
            detail="Coverage will appear when the B3 reserve and operating burn sources are available."
          />
          <Series1ChartPlaceholder
            title="Mining activity"
            description="Active and curtailed fleet state in the current reporting window."
            status="configured"
            label="Mining activity is not available yet"
            detail="Fleet activity will appear after an operating report has been published."
          />
          <Series1Panel>
            <Series1PanelHeader title="Proof & contract status" />
            <Series1RowList>
              <Series1Row label="Network" value="Not configured" />
              <Series1Row label="Contract code" value="Not yet posted" />
              <Series1Row label="Allocation source" value="Pending" />
              <Series1Row label="Delivery evidence" value="At maturity" />
            </Series1RowList>
          </Series1Panel>
        </div>
      </Series1Section>

      <p className="text-xs leading-5" style={{ color: "var(--s1-muted)" }}>
        Accumulated BTC is delivered at maturity. Allocation, reserve and mining figures carry their own provenance; estimates and forward-looking outcomes are not guaranteed.
      </p>
    </Series1Page>
  );
}
