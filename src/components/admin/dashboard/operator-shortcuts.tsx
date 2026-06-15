import Link from "next/link";

import { Card } from "@/components/ui/card";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import type { AdminActionItem } from "@/lib/data/admin-overview";

export function OperatorShortcuts({ actions }: { actions: AdminActionItem[] }) {
  const tracked = actions.filter((action) => action.tracked && action.href);
  if (tracked.length === 0) return null;

  return (
    <section aria-label="Operator shortcuts" className="dashboard-command-shortcuts">
      <div className="flex items-center justify-between mb-4">
        <DashboardPanelHeader title="Operator queues" tone="quiet" className="mb-0" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tracked.map((action) => (
          <Card key={action.key} className="hoverOverlay group transition-colors hover:border-[var(--ct-border-strong)]">
            <Link href={action.href!} className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ct-surface-1)] text-[var(--ct-text-strong)] group-hover:bg-[var(--ct-accent)] group-hover:text-[var(--ct-bg-deep)] transition-colors font-bold">
                {action.count}
              </div>
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-[var(--ct-text-strong)] group-hover:text-[var(--ct-accent)] transition-colors">{action.label}</strong>
                <span className="block truncate body-xs ct-text-muted">{action.hint}</span>
              </div>
            </Link>
          </Card>
        ))}
      </div>
    </section>
  );
}
