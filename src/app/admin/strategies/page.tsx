import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { StrategyIndexClient } from "@/components/admin/strategies/strategy-index-client";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getStrategiesFromDb } from "./queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Strategy Hub — Hearst Connect",
};

export default async function StrategyHubPage() {
  await requireAdmin();
  const workspaces = await getStrategiesFromDb();
  const strategies = workspaces.map(w => w.strategy);

  return (
    <AdminPageShell
      titleLead="Strategy"
      titleAccent="Hub"
      contextLabel="Strategy"
    >
      <StrategyIndexClient initialStrategies={strategies} />
    </AdminPageShell>
  );
}
