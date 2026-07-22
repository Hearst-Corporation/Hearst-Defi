import Link from "next/link";

import { Series1ChartPlaceholder } from "@/components/series1-shell/Series1ChartPlaceholder";
import { Series1KpiBand } from "@/components/series1-shell/Series1KpiBand";
import { Series1Page, Series1PageTitle, Series1Section } from "@/components/series1-shell/Series1Page";
import { Series1Panel, Series1PanelHeader, Series1Row, Series1RowList } from "@/components/series1-shell/Series1Panel";
import { Series1Allocation } from "@/components/series1-shell/Series1Allocation";

export const metadata = {
  title: "Portfolio",
  description: "Your position in the Hearst Bitcoin Reserve Vault — capital deployment, pocket allocation and BTC accumulation.",
};

export default function PortfolioPage() {
  return (
    <Series1Page>
      <Series1PageTitle
        title="Portfolio"
        meta="Series 1 · Methodology v3.0"
        description="Your position in the Hearst Bitcoin Reserve Vault — capital deployment, pocket allocation, BTC accumulation and reserve operations."
        actions={
          <Link
            href="/vaults"
            className="inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-medium"
            style={{ background: "var(--s1-accent)", color: "#08130a" }}
          >
            Subscribe to Series 1 →
          </Link>
        }
      />

      <Series1KpiBand
        hero={{
          label: "Position status",
          value: "Not funded yet",
          hint: "After your first subscription, this position accumulates BTC over a 24-month term.",
        }}
        metrics={[
          { label: "Deposit", value: "—", hint: "USDC subscription" },
          { label: "Deployed value", value: "—", hint: "Current position value" },
          { label: "BTC accumulated", value: "—", hint: "Delivered at maturity" },
          { label: "Term progress", value: "—", hint: "Months elapsed of 24" },
          { label: "Soft lock-up", value: "60 days", hint: "Contractual, not enforced on-chain" },
        ]}
      />

      <Series1Section
        index="01"
        title="Vault health"
        description="This position accumulates BTC over a 24-month term. Accumulated BTC remains in the reserve ledger and is delivered at maturity."
      >
        <Series1ChartPlaceholder
          title="Position value over time"
          status="configured"
          label="No position history yet"
          detail="A value history appears once your first subscription has settled."
        />
      </Series1Section>

      <Series1Section
        index="02"
        title="Capital · 3 pockets · target allocation"
        description="Pockets are the target allocation policy split, derived from your deposit — not a forward projection."
      >
        <Series1Panel>
          <Series1Allocation />
        </Series1Panel>
      </Series1Section>

      <Series1Section
        index="03"
        title="Mining engine · allocated power"
        description="Fleet-level operational readings, estimated from mining allocation — never a per-investor measurement."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Series1Panel>
            <Series1PanelHeader title="Allocated mining power" />
            <div className="p-5">
              <p className="text-xs leading-5" style={{ color: "var(--s1-muted)" }}>
                No mining allocation yet. Once capital is allocated to B1, this panel estimates your allocated fleet
                power from machine cost.
              </p>
            </div>
          </Series1Panel>
          <Series1Panel>
            <Series1PanelHeader title="Rebalancing · vault-level" />
            <Series1RowList>
              <Series1Row label="Last rebalancing" value="—" />
              <Series1Row label="Recorded events" value="0" />
            </Series1RowList>
          </Series1Panel>
        </div>
      </Series1Section>

      <p className="text-xs leading-6" style={{ color: "var(--s1-muted)" }}>
        Financial figures (deposit, value, BTC accumulated) reflect your own account only; each carries its own
        provenance badge. Pockets are estimated target allocations derived from your deposit. This is a mining note:
        it accumulates BTC over a 24-month term with no periodic cash distribution — accumulated BTC is delivered at
        maturity. Forward figures are projections shown as a range under stated assumptions, not guaranteed.
      </p>
    </Series1Page>
  );
}
