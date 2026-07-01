import {
  AdminPageShell,
  AdminSectionCard,
} from "@/components/admin/admin-page-shell";
import { StrategyLibrary } from "@/components/admin/strategies/strategy-library";
import { StrategyTestPanel } from "@/components/admin/strategies/strategy-test-panel";
import { ManualProjectionPanel } from "@/components/admin/strategies/manual-projection-panel";
import { StrategyDataLab } from "@/components/admin/strategies/data-lab/strategy-data-lab";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  PRODUCT_STRATEGIES,
  validateStrategySet,
} from "@/lib/product-strategies";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Strategies — Hearst Connect",
};

export default async function StrategiesPage() {
  await requireAdmin();

  const active = PRODUCT_STRATEGIES.filter((s) => s.status === "active").length;
  const drafts = PRODUCT_STRATEGIES.filter((s) => s.status === "draft").length;
  const violations = validateStrategySet(PRODUCT_STRATEGIES);

  return (
    <AdminPageShell titleLead="Product" titleAccent="Strategies" contextLabel="Strategy">
      <AdminSectionCard
        ariaLabel="Strategy library overview"
        kpiTitle="Strategy library"
        kpiSubtitle="Structured strategies that drive Product Workspace projections — each carries three risk scenarios."
        kpis={[
          { label: "Strategies", value: String(PRODUCT_STRATEGIES.length), sublabel: "in the library", provenance: "manual" },
          { label: "Active", value: String(active), sublabel: "selectable", provenance: "manual" },
          { label: "Drafts", value: String(drafts), sublabel: "not selectable", provenance: "manual" },
          {
            label: "Validation",
            value: violations.length === 0 ? "All valid" : `${violations.length} issue(s)`,
            sublabel: "business rules",
            provenance: "manual",
            ...(violations.length === 0 ? { accent: true } : { alert: true }),
          },
        ]}
      />

      <AdminSectionCard
        ariaLabel="Strategy library"
        title="Strategies — Safe / Balanced / Opportunistic"
        subtitle="Read-only view of every strategy and its three scenarios. The canonical allocation is internal; the reader compares the three risk profiles."
      >
        <StrategyLibrary />
      </AdminSectionCard>

      <AdminSectionCard
        ariaLabel="Test strategy selection"
        title="Test strategy selection"
        subtitle="Play a structured request against the deterministic selection engine — the same engine the Product Workspace uses."
      >
        <StrategyTestPanel />
      </AdminSectionCard>

      <AdminSectionCard
        ariaLabel="Quick 24-month projection"
        title="Quick projection"
        subtitle="Configure collateral + market assumptions and run the deterministic scenario runner — liquidation (red) and repurchase (green) milestones, final ROI, min liquidation distance. No product is created here."
      >
        <ManualProjectionPanel />
      </AdminSectionCard>

      <AdminSectionCard
        ariaLabel="Strategy Data Lab"
        title="Strategy Data Lab"
        subtitle="Backtest across market regimes, run a seeded Monte-Carlo forward simulation, stress-test BTC × electricity shocks, rank sensitivity drivers, and analyse liquidation/repurchase triggers. Conditional, modelled — not guaranteed."
      >
        <StrategyDataLab />
      </AdminSectionCard>
    </AdminPageShell>
  );
}
