import Link from "next/link";

import { DashboardPanelHeader, SystemPanel } from "@/components/ui/system-panel";
import type { AdminActionItem } from "@/lib/data/admin-overview";

export function OperatorShortcuts({ actions }: { actions: AdminActionItem[] }) {
  const tracked = actions.filter((action) => action.tracked && action.href);
  if (tracked.length === 0) return null;

  return (
    <section aria-label="Operator shortcuts" className="dashboard-command-shortcuts">
      <SystemPanel className="dashboard-command-cell">
        <DashboardPanelHeader eyebrow="Shortcuts" title="Operator queues" tone="quiet" />
        <ul className="dashboard-command-shortcuts__list" role="list">
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
      </SystemPanel>
    </section>
  );
}
