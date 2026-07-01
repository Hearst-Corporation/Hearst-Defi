import {
  AdminPageShell,
  AdminSectionCard,
} from "@/components/admin/admin-page-shell";
import { StrategyLibrary } from "@/components/admin/strategies/strategy-library";
import { StrategyTestPanel } from "@/components/admin/strategies/strategy-test-panel";
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
    </AdminPageShell>
  );
}
