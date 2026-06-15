import Link from "next/link";

import { Card } from "@/components/ui/card";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import type { AdminActionItem } from "@/lib/data/admin-overview";

export function OperatorShortcuts({ actions }: { actions: AdminActionItem[] }) {
  const tracked = actions.filter(
    (action): action is AdminActionItem & { href: string } =>
      action.tracked && action.href !== null,
  );
  if (tracked.length === 0) return null;

  return (
    <section aria-label="Operator shortcuts" className="dashboard-command-shortcuts">
      <div className="flex items-center justify-between mb-4">
        <DashboardPanelHeader title="Operator queues" tone="quiet" className="mb-0" />
      </div>
      <div className="dashboard-command-shortcuts__grid">
        {tracked.map((action) => (
          <Card
            key={action.key}
            hoverOverlay={false}
            className="group p-0 transition-colors hover:border-(--ct-border-strong)"
          >
            <Link href={action.href} className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-(--ct-border-accent) bg-(--ct-accent) text-(--ct-bg-deep) shadow-[0_0_18px_color-mix(in_srgb,var(--ct-accent)_20%,transparent)] transition-colors font-bold">
                {action.count}
              </div>
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-(--ct-accent) transition-colors">{action.label}</strong>
                <span className="block truncate body-xs ct-text-muted">{action.hint}</span>
              </div>
            </Link>
          </Card>
        ))}
      </div>
    </section>
  );
}
