import { Series1ChartPlaceholder } from "@/components/series1-shell/Series1ChartPlaceholder";
import { Series1KpiBand } from "@/components/series1-shell/Series1KpiBand";
import { Series1Page, Series1PageTitle, Series1Section } from "@/components/series1-shell/Series1Page";
import { Series1Panel, Series1PanelHeader, Series1Row, Series1RowList } from "@/components/series1-shell/Series1Panel";
import { Series1Timeline } from "@/components/series1-shell/Series1Timeline";

export const metadata = {
  title: "Mining · Hearst Bitcoin Reserve Vault — Series 1",
};

export default function MiningPage() {
  return (
    <Series1Page>
      <Series1PageTitle
        title="Mining"
        description="B1 Mining Power engine — fleet state, hashrate deployment and BTC acquisition cost driving the reserve build."
      />

      <Series1KpiBand
        hero={{
          label: "Fleet status",
          value: "Not configured",
          hint: "Fleet metrics appear once an operating report is recorded.",
        }}
        metrics={[
          { label: "Hashrate deployed", value: "—", hint: "Current reporting window" },
          { label: "Curtailment", value: "—", hint: "Share of window curtailed" },
          { label: "All-in acquisition cost", value: "—", hint: "Per BTC, current window" },
          { label: "Term progress", value: "—", hint: "Months elapsed of 24" },
        ]}
      />

      <Series1Section
        index="01"
        title="Mining engine"
        description="How deployed hashrate converts into Bitcoin acquisition for the reserve."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <Series1ChartPlaceholder
            className="lg:col-span-7"
            title="Hashrate & fleet activity"
            description="Active and curtailed fleet state over the current reporting window."
            status="configured"
            label="Mining activity is not available yet"
            detail="Fleet activity appears after an operating report has been published."
          />
          <Series1Panel className="lg:col-span-5">
            <Series1PanelHeader title="Build flow" />
            <div className="p-5">
              <Series1Timeline
                steps={[
                  { label: "Hashrate deployment", detail: "B1 Mining Power funds fleet deployment." },
                  { label: "Bitcoin production", detail: "Deployed hashrate produces Bitcoin at prevailing network difficulty." },
                  { label: "Operating cost settlement", detail: "Electricity and operations are funded from B3 Operating Reserve." },
                  { label: "Reserve credit", detail: "Net Bitcoin production credits the B2 reserve." },
                ]}
              />
            </div>
          </Series1Panel>
        </div>
      </Series1Section>

      <Series1Section
        index="02"
        title="Cost & curtailment"
        description="Operating figures are kept separate from the investor accumulation outcome."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Series1ChartPlaceholder
            title="All-in BTC acquisition cost"
            status="configured"
            label="Cost history is not available yet"
            detail="A comparison to spot becomes available once cost and spot observations resolve."
          />
          <Series1Panel>
            <Series1PanelHeader title="Curtailment & operations" />
            <Series1RowList>
              <Series1Row label="Curtailment state" value="—" />
              <Series1Row label="Fleet uptime" value="—" />
              <Series1Row label="Last operating report" value="Pending" />
            </Series1RowList>
          </Series1Panel>
        </div>
      </Series1Section>

      <p className="text-xs leading-5" style={{ color: "var(--s1-muted)" }}>
        Mining figures describe the operation and fleet, not an individual investor outcome. No mining yield or fixed rate is implied.
      </p>
    </Series1Page>
  );
}
