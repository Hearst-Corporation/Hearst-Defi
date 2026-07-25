import { existsSync } from "node:fs";
import path from "node:path";

import { AdminPageShell, AdminSectionCard } from "@/components/admin/admin-page-shell";
import { AlertBanner } from "@/components/admin/alert-banner";
import { Section } from "@/views/_shared/layout";
import { ARCHITECTURE_DATA, NodeStatus } from "./data";
import { cn } from "@/lib/cn";

export const metadata = {
  title: "Platform Architecture — Admin Cockpit",
};

/** Badge label — every hand-maintained state reads as a declaration, never a
 *  measured status. "Planned" / "Not configured" already claim nothing live. */
const DECLARED_LABEL: Record<NodeStatus, string> = {
  Live: "Declared live",
  Partial: "Declared partial",
  Planned: "Planned",
  Blocked: "Declared blocked",
  "Not configured": "Not configured",
};

function StatusBadge({ status }: { status: NodeStatus }) {
  const colorMap: Record<NodeStatus, string> = {
    Live: "bg-[var(--ct-accent)]/10 text-[var(--ct-accent)] border-[var(--ct-accent)]/20",
    Partial: "bg-[var(--ct-status-warning)]/10 text-[var(--ct-status-warning)] border-[var(--ct-status-warning)]/20",
    Planned: "bg-[var(--ct-status-info)]/10 text-[var(--ct-status-info)] border-[var(--ct-status-info)]/20",
    // Blocked is a ROADMAP state on a declarative map, not a live error — grey,
    // never red (red would read as a measured outage).
    Blocked: "bg-[var(--color-muted)]/10 text-[var(--color-muted)] border-[var(--color-muted)]/20",
    "Not configured": "bg-[var(--color-faint)]/10 text-[var(--color-faint)] border-[var(--color-faint)]/20",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        colorMap[status]
      )}
    >
      {DECLARED_LABEL[status]}
    </span>
  );
}

type ProbeResult = "present" | "missing" | "unavailable";

/**
 * The ONLY probed fact on this page: fs.existsSync on a repo-relative path of
 * THIS repo, at render time. Existence is NOT health — the badge never says
 * "Live". If the source tree is not available at runtime (e.g. a serverless
 * bundle without src/), the probe reports itself unavailable instead of
 * fabricating "Missing".
 */
function probePresence(probePath: string): ProbeResult {
  const root = process.cwd();
  if (!existsSync(path.join(root, "src", "app"))) return "unavailable";
  return existsSync(path.join(root, probePath)) ? "present" : "missing";
}

const PROBE_BADGE: Record<ProbeResult, { label: string; cls: string }> = {
  present: {
    label: "Present on disk",
    cls: "border-[var(--ct-border)] text-[var(--ct-text-muted)]",
  },
  missing: {
    label: "Missing on disk",
    cls: "border-[var(--ct-status-warning)]/25 text-[var(--ct-status-warning)]",
  },
  unavailable: {
    label: "Probe unavailable — no source tree at runtime",
    cls: "border-[var(--ct-border)] text-[var(--ct-text-faint)]",
  },
};

function ProbeBadge({ result }: { result: ProbeResult }) {
  const b = PROBE_BADGE[result];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        b.cls
      )}
    >
      {b.label}
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
        <AlertBanner tone="info" title="Declarative map — not probed.">
          Every status below is a hand-maintained assertion about the strategy
          platform (strategy.hearst.app), last verified 2026-07-22. This console
          does not monitor those systems — for live probes use /admin/diagnostics.
        </AlertBanner>

        <Section
          title="End-to-end systems map"
          description="How data, engines, workers and surfaces connect — as declared by hand, not as measured."
        >
          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--ct-text-secondary)]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--ct-accent)]" /> Declared live
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--ct-status-warning)]" /> Declared partial
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--ct-status-info)]" /> Planned
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--color-muted)]" /> Declared blocked (roadmap state)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--color-faint)]" /> Not configured
            </span>
          </div>
          <p className="text-xs text-[var(--ct-text-muted)]">
            “Present on disk” / “Missing on disk” are the only probed facts on
            this page: a render-time fs check of THIS repo for nodes naming one
            of its routes. Existence is not health.
          </p>
          <div className="text-xs text-[var(--ct-text-muted)]">
            {totalNodes} nodes · {totalZones} zones — counts of this declared
            map, not an inventory of running systems.
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
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        <StatusBadge status={node.declared} />
                        {node.probePath ? (
                          <ProbeBadge result={probePresence(node.probePath)} />
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </AdminSectionCard>
            ))}
          </div>
        </Section>
      </div>
    </AdminPageShell>
  );
}
