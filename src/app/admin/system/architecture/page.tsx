import { AdminPageShell, AdminSectionCard } from "@/components/admin/admin-page-shell";
import { ARCHITECTURE_DATA, NodeStatus } from "./data";
import { cn } from "@/lib/cn";

export const metadata = {
  title: "Platform Architecture — Admin Cockpit",
};

function StatusBadge({ status }: { status: NodeStatus }) {
  const colorMap: Record<NodeStatus, string> = {
    Live: "bg-[var(--ct-accent)]/10 text-[var(--ct-accent)] border-[var(--ct-accent)]/20",
    Partial: "bg-[var(--ct-status-warning)]/10 text-[var(--ct-status-warning)] border-[var(--ct-status-warning)]/20",
    Planned: "bg-[var(--ct-status-info)]/10 text-[var(--ct-status-info)] border-[var(--ct-status-info)]/20",
    Blocked: "bg-[var(--ct-status-danger)]/10 text-[var(--ct-status-danger)] border-[var(--ct-status-danger)]/20",
    "Not configured": "bg-[var(--ct-status-neutral)]/10 text-[var(--ct-status-neutral)] border-[var(--ct-status-neutral)]/20",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        colorMap[status]
      )}
    >
      {status}
    </span>
  );
}

export default function ArchitecturePage() {
  const totalNodes = ARCHITECTURE_DATA.reduce((acc, zone) => acc + zone.nodes.length, 0);
  const totalZones = ARCHITECTURE_DATA.length;

  return (
    <AdminPageShell
      titleLead="Platform"
      titleAccent="Architecture"
      contextLabel="System"
    >
      <div className="flex flex-col gap-8 pb-12">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-[var(--ct-text-primary)]">
            End-to-end systems map
          </h2>
          <p className="text-[var(--ct-text-secondary)]">
            How data, engines, workers and surfaces connect.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-[var(--ct-text-secondary)]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--ct-accent)]" /> Live
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--ct-status-warning)]" /> Partial
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--ct-status-info)]" /> Planned
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--ct-status-danger)]" /> Blocked
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--ct-status-neutral)]" /> Not configured
            </span>
          </div>
          <div className="mt-2 text-xs text-[var(--ct-text-muted)]">
            {totalNodes} nodes · 59 edges · {totalZones} zones
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 2xl:grid-cols-3">
          {ARCHITECTURE_DATA.map((zone) => (
            <AdminSectionCard
              key={zone.id}
              title={
                <span className="flex items-center gap-2">
                  <span className="text-[var(--ct-text-muted)]">{zone.letter} ·</span>
                  {zone.name}
                </span>
              }
              subtitle={zone.description}
              headerTrailing={
                <span className="text-xs font-medium text-[var(--ct-text-muted)]">
                  {zone.nodes.length} nodes
                </span>
              }
            >
              <div className="flex flex-1 flex-col divide-y divide-[var(--ct-border-soft)]">
                {zone.nodes.map((node) => (
                  <div
                    key={node.id}
                    className="flex flex-col gap-2 p-4 transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="font-medium text-[var(--ct-text-primary)] break-words">
                        {node.name}
                      </div>
                      {node.description && (
                        <div className="text-sm text-[var(--ct-text-secondary)] break-words">
                          {node.description}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      <StatusBadge status={node.status} />
                    </div>
                  </div>
                ))}
              </div>
            </AdminSectionCard>
          ))}
        </div>
      </div>
    </AdminPageShell>
  );
}
