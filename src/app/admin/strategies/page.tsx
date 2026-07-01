import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { StrategyHubClient } from "@/components/admin/strategies/strategy-hub-client";
import { requireAdmin } from "@/lib/auth/require-admin";
import { PRODUCT_STRATEGIES } from "@/lib/product-strategies";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Strategy Hub — Hearst Connect",
};

export default async function StrategyHubPage() {
  await requireAdmin();

  return (
    <AdminPageShell
      titleLead="Strategy"
      titleAccent="Hub"
      contextLabel="Strategy"
    >
      <StrategyHubClient initialStrategies={PRODUCT_STRATEGIES} />
    </AdminPageShell>
  );
}
