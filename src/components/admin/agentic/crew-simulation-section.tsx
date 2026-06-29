// Admin · Agentic Control Tower — Crew Simulation (presentational).
//
// READ-ONLY. Bento conversion 2026-06-28: each crew scenario is a black
// BentoPanel (scenario header · risk/mode/gates KPI strip · nested step rail).
// `executable: false` is stated once in the section header. No run / send /
// deploy / source control anywhere — these are simulations, nothing executes.
// No hardcoded colour outside the canon (--ct-accent, #15191C sub-surface).
// Pure component.

import { BentoHeader, BentoPanel } from "@/components/catalyst/bento";
import type {
  CrewSimulationMode,
  CrewSimulationResult,
  CrewSimulationRisk,
} from "@/lib/agentic/crew-simulation/types";

const MODE_LABEL: Record<CrewSimulationMode, string> = {
  read_only: "read-only",
  draft_only: "draft-only",
  confirmed_write_blocked: "write blocked",
  forbidden: "forbidden",
};

type Tone = "ok" | "warn" | "danger" | "muted";

function riskTone(risk: CrewSimulationRisk): Tone {
  if (risk === "critical" || risk === "high") return "danger";
  if (risk === "medium") return "warn";
  return "muted";
}

function modeTone(mode: CrewSimulationMode): Tone {
  if (mode === "read_only") return "ok";
  if (mode === "forbidden") return "danger";
  return "warn";
}

const DOT_CLASS: Record<Tone, string> = {
  ok: "bg-[var(--ct-accent)]",
  warn: "bg-[var(--ct-status-warning)]",
  danger: "bg-[var(--ct-status-danger)]",
  muted: "bg-[var(--ct-text-faint)]",
};

const TAG_CLASS: Record<Tone, string> = {
  ok: "border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[var(--ct-accent)]",
  warn: "border-[var(--ct-status-warning-border)] bg-[var(--ct-status-warning-soft)] text-[var(--ct-status-warning)]",
  danger: "border-[var(--ct-status-danger-border)] bg-[var(--ct-status-danger-soft)] text-[var(--ct-status-danger)]",
  muted: "border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] text-[var(--ct-text-muted)]",
};

/** Micro uppercase label. */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="ct-bento-label">
      {children}
    </span>
  );
}

/** Tokenised inline tag with a leading status dot. */
function Tag({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[length:var(--ct-text-micro)] font-medium ${TAG_CLASS[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[tone]}`} aria-hidden />
      {children}
    </span>
  );
}

/** One labelled stat cell inside the per-scenario KPI strip. */
function KpiCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 bg-surface-inset p-4">
      <Label>{label}</Label>
      <div className="flex items-center">{children}</div>
    </div>
  );
}

export function CrewSimulationSection({
  simulations,
}: {
  simulations: CrewSimulationResult[] | null | undefined;
}) {
  if (!simulations || simulations.length === 0) return null;

  return (
    <BentoPanel className="bg-transparent border-0 shadow-none gap-4">
      <BentoHeader
        className="px-0 pt-0"
        title="Crew Simulation"
        subtitle="What each crew would do — read-only simulation. No step executes; no tool is called."
        trailing={<Tag tone="danger">executable: false</Tag>}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {simulations.map(
          ({ scenario, summary, requiredGates, blockedActions }) => {
            const showRisk = scenario.risk !== "low" && scenario.risk !== "none";
            return (
              <BentoPanel key={scenario.id} className="bg-surface-inset">
                <div className="flex flex-col gap-1.5 p-5">
                  <h3 className="text-[length:var(--ct-text-14)] font-semibold leading-tight text-white">
                    {scenario.label}
                  </h3>
                  <p className="text-[length:var(--ct-text-2xs)] leading-relaxed text-[var(--ct-text-muted)]">
                    {summary}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-px overflow-hidden border-y border-[var(--ct-border-soft)] bg-surface-card">
                  <KpiCell label="Risk">
                    {showRisk ? (
                      <Tag tone={riskTone(scenario.risk)}>{scenario.risk}</Tag>
                    ) : (
                      <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-faint)]">—</span>
                    )}
                  </KpiCell>
                  <KpiCell label="Mode">
                    <Tag tone={modeTone(scenario.mode)}>
                      {MODE_LABEL[scenario.mode]}
                    </Tag>
                  </KpiCell>
                  <KpiCell label="Gates">
                    <span className="text-[length:var(--ct-text-14)] font-medium tabular-nums text-white">
                      {requiredGates.length || "—"}
                    </span>
                  </KpiCell>
                </div>

                <div className="flex flex-col gap-3 p-5">
                  <details className="group">
                    <summary className="ct-bento-label flex cursor-pointer list-none items-center gap-2 transition-colors hover:text-[var(--ct-text-body)]">
                      <span
                        className="inline-block h-1.5 w-1.5 rotate-45 border-b border-r border-current transition-transform group-open:rotate-[225deg]"
                        aria-hidden
                      />
                      Flow · {scenario.steps.length} steps
                    </summary>
                    <ol className="mt-3 flex flex-col gap-2">
                      {scenario.steps.map((step, i) => (
                        <li
                          key={step.id}
                          className="flex items-center gap-3 rounded-lg border border-[var(--ct-border-soft)] bg-black/40 px-3 py-2"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] text-[length:var(--ct-text-deci)] font-bold tabular-nums text-[var(--ct-text-muted)]">
                            {i + 1}
                          </span>
                          <span className="flex-1 text-[length:var(--ct-text-2xs)] text-[var(--ct-text-body)]">
                            {step.label}
                          </span>
                          <span className="text-[length:var(--ct-text-deci)] uppercase tracking-[0.1em] font-bold text-[var(--ct-text-faint)]">
                            {MODE_LABEL[step.mode]}
                          </span>
                        </li>
                      ))}
                    </ol>

                    {blockedActions.length > 0 && (
                      <div className="mt-3 flex flex-col gap-2">
                        <Label>Blocked</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {blockedActions.map((action) => (
                            <span
                              key={action}
                              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--ct-status-danger-border)] bg-[var(--ct-status-danger-soft)] px-2 py-0.5 text-[length:var(--ct-text-micro)] text-[var(--ct-status-danger)]"
                            >
                              <span
                                className="h-1 w-1 rounded-full bg-[var(--ct-status-danger)]"
                                aria-hidden
                              />
                              {action}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </details>
                </div>
              </BentoPanel>
            );
          },
        )}
      </div>
    </BentoPanel>
  );
}
