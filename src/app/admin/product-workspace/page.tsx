import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { requireAdmin } from "@/lib/auth/require-admin";
import { VAULTS, VAULT_YIELD, type VaultDefinition } from "@/lib/engine/vaults";
import { isExplicitSimulationIntent } from "@/lib/llm/product-workspace-intent";

export const dynamic = "force-dynamic";

interface ProductWorkspacePageProps {
  searchParams: Promise<{ autostart?: string; objective?: string }>;
}

const MAX_OBJECTIVE_LEN = 220;

interface ProductGraphSpec {
  title: string;
  chart: string;
  series: string;
  note: string;
  progress: number;
}

const GRAPH_SPECS: readonly ProductGraphSpec[] = [
  {
    title: "Capital Stack",
    chart: "Stacked allocation bar",
    series: "Mining cashflow, USDC base, BTC tactical, stable reserve",
    note: "Compare target weights against hard bounds before any vault draft.",
    progress: 72,
  },
  {
    title: "Distribution Path",
    chart: "12-month range band",
    series: "P25/P75 monthly USDC distributions",
    note: "Shows range only; no single-point APY headline.",
    progress: 58,
  },
  {
    title: "Stress Corridor",
    chart: "Drawdown and liquidity curve",
    series: "BTC shock, hashprice compression, stable depeg, liquidity buffer",
    note: "PTAI trigger candidates must map to documented rule IDs.",
    progress: 44,
  },
];

const BUCKET_LABELS: Record<keyof VaultDefinition["allocationTargets"], string> = {
  mining: "Mining",
  btc_tactical: "BTC tactical",
  usdc_base: "USDC base",
  stable_reserve: "Stable reserve",
};

const CALC_NOTES = [
  "APY headline stays a range and must carry provenance before publication.",
  "Mining contribution is treated as estimated until partner attestation is attached.",
  "Monthly distribution notes must include assumptions and a conditional-projection disclaimer.",
  "Scenario Lab becomes a downstream validation step, not the product creation surface.",
] as const;

const OUT_OF_MANDATE_RE =
  /\b(retail|public offer|auto.?execute|autonomous execution|no kyc|without kyc|bypass approval|bypass approvals|single point yield|fixed yield)\b/i;

const DECISION_LANES = [
  {
    label: "Proceed",
    status: "Draft workspace ready",
    detail: "Use once objective, allocation bounds and compliance posture are explicit.",
  },
  {
    label: "Hold",
    status: "Evidence missing",
    detail: "Pause if provenance, legal wrapper or partner attestation is incomplete.",
  },
  {
    label: "Reject",
    status: "Out of mandate",
    detail: "Reject if product needs autonomous execution, single-point yield, or retail access.",
  },
] as const;

function sanitizeObjective(raw: string | undefined): string | undefined {
  const cleaned = raw?.replace(/[\x00-\x1F\x7F]/g, "").trim();
  return cleaned ? cleaned.slice(0, MAX_OBJECTIVE_LEN) : undefined;
}

function inferVault(objective: string | undefined): VaultDefinition {
  const lowered = objective?.toLowerCase() ?? "";
  if (/\b(defensive|defensif|défensif|capital preservation|preservation)\b/.test(lowered)) {
    return VAULTS.defensive;
  }
  if (/\b(btc plus|btc-plus|bitcoin plus|hbp|opportunistic|opportuniste)\b/.test(lowered)) {
    return VAULTS["btc-plus"];
  }
  if (/\b(yield|hyv|rendement)\b/.test(lowered)) {
    return VAULTS.yield;
  }
  return VAULT_YIELD;
}

function decisionForObjective(
  objective: string | undefined,
  autostart: boolean,
): (typeof DECISION_LANES)[number] {
  if (objective && OUT_OF_MANDATE_RE.test(objective)) {
    return DECISION_LANES[2]!;
  }
  if (objective && autostart) {
    return DECISION_LANES[0]!;
  }
  return DECISION_LANES[1]!;
}

function graphSpecsForVault(vault: VaultDefinition): ProductGraphSpec[] {
  const allocationSeries = Object.entries(vault.allocationTargets)
    .map(
      ([bucket, weight]) =>
        `${BUCKET_LABELS[bucket as keyof VaultDefinition["allocationTargets"]]} ${weight}%`,
    )
    .join(", ");
  return GRAPH_SPECS.map((spec) =>
    spec.title === "Capital Stack"
      ? {
          ...spec,
          series: allocationSeries,
          note: `${vault.ticker} target mix from methodology ${vault.methodologyVersion}; validate hard bounds before any vault draft.`,
        }
      : spec.title === "Distribution Path"
        ? {
            ...spec,
            series: `${vault.apyTarget.low}-${vault.apyTarget.high}% target APY range; P25/P75 monthly USDC distributions`,
          }
        : spec,
  );
}

function productThesis(vault: VaultDefinition, objective: string | undefined): string {
  if (objective) {
    return `Frame ${vault.ticker} around the admin objective: ${objective}`;
  }
  return `Frame ${vault.ticker} as an independent product workspace before any vault draft or simulation run.`;
}

function scenarioOutputs(objective: string | undefined): string[] {
  if (objective && isExplicitSimulationIntent(objective)) {
    return [
      "Scenario output requested: use Scenario Lab as a supporting validation tool.",
      "Bring back APY range, drawdown estimate, monthly distribution range and PTAI notes into this workspace.",
    ];
  }
  return [
    "No scenario output requested yet.",
    "If needed, run Scenario Lab later and attach results here as supporting evidence.",
  ];
}

export default async function ProductWorkspacePage({
  searchParams,
}: ProductWorkspacePageProps) {
  await requireAdmin();
  const params = await searchParams;
  const objective = sanitizeObjective(params.objective);
  const autostart = params.autostart === "1";
  const inferredVault = inferVault(objective);
  const decision = decisionForObjective(objective, autostart);
  const graphSpecs = graphSpecsForVault(inferredVault);
  const scenarioOutputNotes = scenarioOutputs(objective);

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Product Workspace"
        eyebrow="Agent-created product surface"
        description="Independent workspace for new product framing. It captures the agent objective, chart specs, calculation notes and decision gates before any Scenario Lab validation."
        actions={
          <div className="admin-doc-inline-row admin-doc-inline-row--dense">
            <Badge variant={autostart ? "success" : "default"}>
              {autostart ? "Seeded by agent" : "Manual"}
            </Badge>
            <ProvenanceBadge kind="manual" />
          </div>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <Card hoverOverlay={false} className="admin-doc-stack admin-doc-stack--relaxed">
          <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--start">
            <div className="admin-doc-stack admin-doc-stack--tight">
              <span className="stat-label">Product brief</span>
              <h2 className="h2 ct-text-strong">
                {objective ?? "New product objective pending"}
              </h2>
            </div>
            <Badge variant="accent">Human-in-the-loop</Badge>
          </div>
          <p className="body-sm ct-text-muted max-w-3xl">
            The agent can frame, visualize and document the product workspace, but it
            cannot create a vault, execute allocations, publish a memo or bypass approvals.
            This page is the decision room; Scenario Lab is only used later for stress
            validation.
          </p>

          <div className="rounded-2xl border border-[var(--ct-border-soft)] ct-surface-1 p-4">
            <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--start">
              <div className="admin-doc-stack admin-doc-stack--tight">
                <span className="stat-label">Agent decision</span>
                <p className="body-sm ct-text-strong">
                  {decision.label}: {decision.status}
                </p>
                <p className="body-xs ct-text-muted">{decision.detail}</p>
              </div>
              <ProvenanceBadge kind="manual" />
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="admin-doc-stack admin-doc-stack--tight rounded-2xl border border-[var(--ct-border-soft)] ct-surface-1 p-4">
              <span className="stat-label">Product thesis</span>
              <p className="body-sm ct-text-muted">{productThesis(inferredVault, objective)}</p>
            </div>
            <div className="admin-doc-stack admin-doc-stack--tight rounded-2xl border border-[var(--ct-border-soft)] ct-surface-1 p-4">
              <span className="stat-label">Generated product artifact</span>
              <p className="body-sm ct-text-muted">
                Draft artifact: {inferredVault.ticker} product workspace with thesis,
                assumptions, chart specs, calculation notes, decision gate and next actions.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="admin-doc-stack admin-doc-stack--tight rounded-2xl border border-[var(--ct-border-soft)] ct-surface-1 p-4">
              <span className="stat-label">Inferred vault</span>
              <p className="body-sm ct-text-strong">
                {inferredVault.label} · {inferredVault.ticker}
              </p>
              <p className="body-xs ct-text-muted">
                Base mode: {inferredVault.baseMode}
              </p>
            </div>
            <div className="admin-doc-stack admin-doc-stack--tight rounded-2xl border border-[var(--ct-border-soft)] ct-surface-1 p-4">
              <span className="stat-label">APY range</span>
              <p className="body-sm ct-text-strong">
                {inferredVault.apyTarget.low}-{inferredVault.apyTarget.high}%
              </p>
              <p className="body-xs ct-text-muted">
                Range only, estimated provenance until evidence is attached.
              </p>
            </div>
            <div className="admin-doc-stack admin-doc-stack--tight rounded-2xl border border-[var(--ct-border-soft)] ct-surface-1 p-4">
              <span className="stat-label">Methodology</span>
              <p className="body-sm ct-text-strong">
                {inferredVault.methodologyVersion}
              </p>
              <p className="body-xs ct-text-muted">
                Assumptions must remain visible in every projection.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {DECISION_LANES.map((lane) => (
              <div
                key={lane.label}
                className="admin-doc-stack admin-doc-stack--tight rounded-2xl border border-[var(--ct-border-soft)] ct-surface-1 p-4"
              >
                <div className="admin-doc-inline-row admin-doc-inline-row--between">
                  <span className="stat-label">{lane.label}</span>
                  <ProvenanceBadge kind="manual" compact />
                </div>
                <p className="body-sm ct-text-strong">{lane.status}</p>
                <p className="body-xs ct-text-muted">{lane.detail}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card hoverOverlay={false} className="admin-doc-stack admin-doc-stack--actions">
          <CardTitle>Calculation Notes</CardTitle>
          <ul className="admin-doc-stack admin-doc-stack--tight">
            {CALC_NOTES.map((note) => (
              <li key={note} className="admin-doc-inline-row admin-doc-inline-row--start">
                <span
                  aria-hidden
                  className="mt-2 h-1.5 w-1.5 rounded-full bg-(--ct-accent)"
                />
                <span className="body-sm ct-text-muted">{note}</span>
              </li>
            ))}
          </ul>
          <div className="rounded-2xl border border-(--ct-status-warning-border) ct-status-warning-bg px-4 py-3">
            <p className="stat-label ct-status-warning">Required disclaimer</p>
            <p className="mt-1 body-xs ct-text-muted">
              Projection conditionnelle aux hypothèses présentées, sans engagement de
              résultat. Souscription réservée aux investisseurs professionnels/qualifiés.
            </p>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card hoverOverlay={false} className="admin-doc-stack admin-doc-stack--actions">
          <CardTitle>Assumptions</CardTitle>
          <ul className="admin-doc-stack admin-doc-stack--tight">
            {inferredVault.assumptions.map((assumption) => (
              <li key={assumption} className="body-sm ct-text-muted">
                {assumption}
              </li>
            ))}
          </ul>
        </Card>

        <Card hoverOverlay={false} className="admin-doc-stack admin-doc-stack--actions">
          <CardTitle>Scenario Outputs</CardTitle>
          <ul className="admin-doc-stack admin-doc-stack--tight">
            {scenarioOutputNotes.map((note) => (
              <li key={note} className="body-sm ct-text-muted">
                {note}
              </li>
            ))}
          </ul>
        </Card>

        <Card hoverOverlay={false} className="admin-doc-stack admin-doc-stack--actions">
          <CardTitle>Next Actions</CardTitle>
          <ol className="admin-doc-stack admin-doc-stack--tight">
            <li className="body-sm ct-text-muted">
              Attach provenance evidence for every metric before publication.
            </li>
            <li className="body-sm ct-text-muted">
              If simulation is required, run Scenario Lab and paste outputs back here.
            </li>
            <li className="body-sm ct-text-muted">
              Capture the final human decision in governance or review notes.
            </li>
          </ol>
        </Card>
      </section>

      <section className="admin-doc-section">
        <div className="admin-doc-section__head">
          <div>
            <p className="stat-label">Agent graph specs</p>
            <h2 className="h2 ct-text-strong">Visuals to attach before review</h2>
          </div>
          <Badge variant="default">Draft specs</Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {graphSpecs.map((spec) => (
            <Card
              key={spec.title}
              hoverOverlay={false}
              className="admin-doc-stack admin-doc-stack--actions"
            >
              <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--start">
                <div>
                  <p className="stat-label">{spec.chart}</p>
                  <CardTitle>{spec.title}</CardTitle>
                </div>
                <ProvenanceBadge kind="estimated" compact />
              </div>
              <p className="body-sm ct-text-muted">{spec.series}</p>
              <Progress value={spec.progress} label={`${spec.title} readiness`} />
              <p className="body-xs ct-text-muted">{spec.note}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
