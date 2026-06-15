import Link from "next/link";

import { Card } from "@/components/ui/card";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import type { AdminActionItem } from "@/lib/data/admin-overview";

export function OperatorShortcuts({ actions }: { actions: AdminActionItem[] }) {
  const tracked = actions.filter((action) => action.tracked && action.href);
  if (tracked.length === 0) return null;

  return (
    <section aria-label="Operator shortcuts" className="dashboard-command-shortcuts">
      <Card className="dashboard-command-cell p-6 sm:p-8">
        <DashboardPanelHeader title="Operator queues" tone="quiet" className="mb-6" />
        <ul className="space-y-2" role="list">
          {tracked.map((action) => (
            <li key={action.key}>
              <Link href={action.href!} className="dashboard-command-queue-link">
                <span className="dashboard-command-queue-link__count">{action.count}</span>
                <span>
                  <strong>{action.label}</strong>
                  <span className="block body-xs ct-text-muted">{action.hint}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
