import { Series1ChartPlaceholder } from "@/components/series1-shell/Series1ChartPlaceholder";
import { Series1KpiBand } from "@/components/series1-shell/Series1KpiBand";
import { Series1Page, Series1PageTitle, Series1Section } from "@/components/series1-shell/Series1Page";
import { Series1Panel, Series1PanelHeader, Series1Row, Series1RowList } from "@/components/series1-shell/Series1Panel";
import { Series1Allocation } from "@/components/series1-shell/Series1Allocation";

export const metadata = {
  title: "Bitcoin Reserve · Hearst Bitcoin Reserve Vault — Series 1",
};

export default function BtcPage() {
  return (
    <Series1Page>
      <Series1PageTitle
        title="Bitcoin Reserve"
        meta="Methodology v3.0"
        description="Your attributed Bitcoin register, backed by the program reserve and mining ledger."
      />

      <Series1KpiBand
        hero={{
          label: "Bitcoin position",
          value: "Not configured",
          hint: "PermissionedDynaVault v2.1 has not been posted.",
        }}
        metrics={[
          { label: "Vault reserve", value: "—", hint: "Program BTC reserve" },
          { label: "Mining produced", value: "—", hint: "Cumulative program ledger" },
          { label: "Current value", value: "—", hint: "Reported valuation" },
          { label: "Term progress", value: "—", hint: "Months elapsed of 24" },
          { label: "Reserve runway", value: "—", hint: "B3 coverage estimate" },
          { label: "Custody", value: "Awaiting", hint: "Evidence source" },
        ]}
      />

      <Series1Section
        index="01"
        title="Accumulation register"
        description="Bitcoin credits become visible after they are indexed from mining operations."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <Series1ChartPlaceholder
            className="lg:col-span-8"
            title="Attributed BTC over time"
            description="Mining credits attributed to the current investor position."
            status="configured"
            label="Accumulation history is not available yet"
            detail="The ledger chart appears after mining credits are indexed."
          />
          <Series1Panel className="lg:col-span-4">
            <Series1PanelHeader title="Allocation basis" />
            <Series1Allocation />
          </Series1Panel>
        </div>
      </Series1Section>

      <Series1Section
        index="02"
        title="Reserve & custody"
        description="Supporting evidence is presented as separate records, not as a synthetic return projection."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Series1ChartPlaceholder
            title="Acquisition cost vs spot"
            status="configured"
            label="Cost history is not available yet"
            detail="No resolved monthly cost and BTC spot observation pair is available."
          />
          <Series1ChartPlaceholder
            title="Reserve runway"
            description="Electricity coverage funded by B3 Reserve USDC."
            status="configured"
            label="Reserve runway is not available yet"
            detail="Coverage appears when reserve and operating-burn sources are available."
          />
          <Series1Panel>
            <Series1PanelHeader title="Custody & delivery" />
            <Series1RowList>
              <Series1Row label="Custody evidence" value="Awaiting" />
              <Series1Row label="Delivery" value="At maturity" />
              <Series1Row label="Ledger events" value="—" />
            </Series1RowList>
          </Series1Panel>
        </div>
      </Series1Section>

      <p className="text-xs leading-5" style={{ color: "var(--s1-muted)" }}>
        Accumulated BTC is delivered at maturity. Reported valuations and reserve coverage are not guaranteed.
      </p>
    </Series1Page>
  );
}
