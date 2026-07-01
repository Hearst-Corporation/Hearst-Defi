import { notFound } from "next/navigation";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { StrategyWorkspaceClient } from "@/components/admin/strategies/strategy-workspace-client";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getStrategiesFromDb } from "../queries";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props) {
  const workspaces = await getStrategiesFromDb();
  const strategy = workspaces.find((w) => w.strategy.slug === params.slug)?.strategy;
  if (!strategy) return { title: "Strategy Not Found" };
  return {
    title: `${strategy.name} — Strategy Workspace`,
  };
}

export default async function StrategyWorkspacePage({ params }: Props) {
  await requireAdmin();

  const workspaces = await getStrategiesFromDb();
  const workspace = workspaces.find((w) => w.strategy.slug === params.slug);
  if (!workspace) {
    notFound();
  }

  const allStrategies = workspaces.map(w => w.strategy);

  return (
    <AdminPageShell
      titleLead="Strategy"
      titleAccent="Workspace"
      contextLabel={workspace.strategy.name}
    >
      <StrategyWorkspaceClient
        initialWorkspace={workspace}
        allInitialStrategies={allStrategies}
      />
    </AdminPageShell>
  );
}
