import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { requireAdmin } from "@/lib/auth/require-admin";
import { VAULTS, VAULT_YIELD, type VaultDefinition } from "@/lib/engine/vaults";
import {
  isExplicitSimulationIntent,
  type ProductWorkspaceIntentKind,
} from "@/lib/llm/product-workspace-intent";
import {
  loadProductWorkspaceDraft,
  upsertProductWorkspaceDraft,
} from "@/lib/product-workspace/draft";

export const dynamic = "force-dynamic";

interface ProductWorkspacePageProps {
  searchParams: Promise<{
    autostart?: string;
    objective?: string;
    intent?: string;
    secondary?: string;
    secondaryHint?: string;
  }>;
}

const MAX_OBJECTIVE_LEN = 220;

interface ProductGraphSpec {
  title: string;
  chart: string;
  series: string;
  note: string;
  metric: string;
  visual: React.ReactNode;
}

const BASE_GRAPH_SPECS = [
  {
    title: "Capital Stack",
    chart: "Stacked allocation bar",
    series: "Mining cashflow, USDC base, BTC tactical, stable reserve",
    note: "Compare target weights against hard bounds before any vault draft.",
  },
  {
    title: "Distribution Path",
    chart: "12-month range band",
    series: "P25/P75 monthly USDC distributions",
    note: "Shows range only; no single-point APY headline.",
  },
  {
    title: "Stress Corridor",
    chart: "Drawdown and liquidity curve",
    series: "BTC shock, hashprice compression, stable depeg, liquidity buffer",
    note: "PTAI trigger candidates must map to documented rule IDs.",
  },
] as const;

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

function parseIntentKind(raw: string | undefined): ProductWorkspaceIntentKind | undefined {
  switch (raw) {
    case "product_creation":
    case "product_framing":
    case "explicit_simulation":
    case "mixed_product_creation_simulation":
    case "mixed_product_framing_simulation":
      return raw;
    default:
      return undefined;
  }
}

function sanitizeHint(raw: string | undefined): string | undefined {
  const cleaned = raw?.replace(/[\x00-\x1F\x7F]/g, "").trim();
  return cleaned ? cleaned.slice(0, 120) : undefined;
}

function buildScenarioLabHref(objective: string | undefined): string {
  const params = new URLSearchParams();
  params.set("autostart", "1");
  if (objective) params.set("objective", objective);
  return `/admin/scenario-lab?${params.toString()}`;
}

function hasScenarioSecondary(
  objective: string | undefined,
  intentKind: ProductWorkspaceIntentKind | undefined,
  secondary: string | undefined,
): boolean {
  return (
    secondary === "scenario-lab" ||
    intentKind === "mixed_product_creation_simulation" ||
    intentKind === "mixed_product_framing_simulation" ||
    (objective ? isExplicitSimulationIntent(objective) : false)
  );
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
  return BASE_GRAPH_SPECS.map((spec) => {
    if (spec.title === "Capital Stack") {
      return {
        ...spec,
        series: allocationSeries,
        note: `${vault.ticker} target mix from methodology ${vault.methodologyVersion}; validate hard bounds before any vault draft.`,
        metric: "Target weights",
        visual: <AllocationStackChart vault={vault} />,
      };
    }
    if (spec.title === "Distribution Path") {
      return {
        ...spec,
        series: `${vault.apyTarget.low}-${vault.apyTarget.high}% target APY range; P25/P75 monthly USDC distributions`,
        metric: `${vault.apyTarget.low}-${vault.apyTarget.high}% APY range`,
        visual: <DistributionRangeChart vault={vault} />,
      };
    }
    return {
      ...spec,
      metric: "PTAI stress corridor",
      visual: <StressCorridorChart vault={vault} />,
    };
  });
}

function AllocationStackChart({ vault }: { vault: VaultDefinition }) {
  const colors = ["#A7FB90", "#7DD3FC", "#FDE68A", "#C4B5FD"];
  let x = 0;
  return (
    <svg viewBox="0 0 320 72" role="img" aria-label={`${vault.ticker} allocation stack`}>
      <rect x="0" y="24" width="320" height="18" rx="9" className="fill-(--ct-surface-2)" />
      {Object.entries(vault.allocationTargets).map(([bucket, weight], index) => {
        const width = (weight / 100) * 320;
        const currentX = x;
        x += width;
        return (
          <g key={bucket}>
            <rect
              x={currentX}
              y="24"
              width={width}
              height="18"
              rx="9"
              fill={colors[index] ?? "#A7FB90"}
              opacity="0.9"
            />
            <text x={currentX + 4} y="58" className="fill-(--ct-text-muted) text-[9px]">
              {weight}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DistributionRangeChart({ vault }: { vault: VaultDefinition }) {
  const months = Array.from({ length: 12 }, (_, index) => index);
  const low = vault.apyTarget.low;
  const high = vault.apyTarget.high;
  const pointsLow = months
    .map((month) => `${24 + month * 24},${52 - (low + month * 0.12) * 1.2}`)
    .join(" ");
  const pointsHigh = months
    .map((month) => `${24 + month * 24},${52 - (high + month * 0.16) * 1.2}`)
    .join(" ");
  return (
    <svg viewBox="0 0 320 72" role="img" aria-label={`${vault.ticker} distribution range`}>
      <polyline points={pointsHigh} fill="none" stroke="#A7FB90" strokeWidth="2" />
      <polyline points={pointsLow} fill="none" stroke="#7DD3FC" strokeWidth="2" />
      <line x1="24" y1="56" x2="288" y2="56" className="stroke-(--ct-border-soft)" />
      <text x="24" y="68" className="fill-(--ct-text-muted) text-[9px]">M1</text>
      <text x="266" y="68" className="fill-(--ct-text-muted) text-[9px]">M12</text>
    </svg>
  );
}

function StressCorridorChart({ vault }: { vault: VaultDefinition }) {
  const reserve = vault.allocationTargets.stable_reserve;
  const mining = vault.allocationTargets.mining;
  const corridor = [
    `24,${34 + mining * 0.18}`,
    `88,${30 + reserve * 0.08}`,
    `152,${40 - reserve * 0.12}`,
    `216,${34 - reserve * 0.08}`,
    `288,${28 - reserve * 0.05}`,
  ].join(" ");
  return (
    <svg viewBox="0 0 320 72" role="img" aria-label={`${vault.ticker} stress corridor`}>
      <polyline points={corridor} fill="none" stroke="#FDE68A" strokeWidth="2.5" />
      <line x1="24" y1="54" x2="288" y2="54" className="stroke-(--ct-border-soft)" />
      <circle cx="152" cy={40 - reserve * 0.12} r="4" fill="#A7FB90" />
      <text x="24" y="68" className="fill-(--ct-text-muted) text-[9px]">Shock</text>
      <text x="232" y="68" className="fill-(--ct-text-muted) text-[9px]">Recovery</text>
    </svg>
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
  const admin = await requireAdmin();
  const params = await searchParams;
  const objective = sanitizeObjective(params.objective);
  const autostart = params.autostart === "1";
  const intentKind = parseIntentKind(params.intent);
  const secondaryHint = sanitizeHint(params.secondaryHint);
  const scenarioSecondary = hasScenarioSecondary(
    objective,
    intentKind,
    params.secondary,
  );
  const inferredVault = inferVault(objective);
  const decision = decisionForObjective(objective, autostart);
  const graphSpecs = graphSpecsForVault(inferredVault);
  const scenarioOutputNotes = scenarioOutputs(objective);
  const persistedDraft =
    objective && autostart
      ? await upsertProductWorkspaceDraft({
          userId: admin.userId,
          objective,
          vaultTicker: inferredVault.ticker,
          vaultLabel: inferredVault.label,
          ...(intentKind ? { intentKind } : {}),
          scenarioValidationQueued: scenarioSecondary,
        })
      : await loadProductWorkspaceDraft(admin.userId);

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
            {scenarioSecondary ? (
              <Badge variant="warning">Scenario validation queued</Badge>
            ) : null}
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

          {/* Agent decision — flat row, no nested card */}
          <div className="border-t ct-bc-soft pt-4 admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--start">
            <div className="admin-doc-stack admin-doc-stack--tight">
              <span className="stat-label">Agent decision</span>
              <p className="body-sm ct-text-strong">
                {decision.label}: {decision.status}
              </p>
              <p className="body-xs ct-text-muted">{decision.detail}</p>
            </div>
            <ProvenanceBadge kind="manual" />
          </div>

          {/* Product thesis */}
          <div className="border-t ct-bc-soft pt-4 admin-doc-stack admin-doc-stack--tight">
            <span className="stat-label">Product thesis</span>
            <p className="body-sm ct-text-muted">{productThesis(inferredVault, objective)}</p>
          </div>

          {/* Generated artifact */}
          <div className="border-t ct-bc-soft pt-4 admin-doc-stack admin-doc-stack--tight">
            <span className="stat-label">Generated product artifact</span>
            <p className="body-sm ct-text-muted">
              Draft artifact: {inferredVault.ticker} product workspace with thesis,
              assumptions, chart specs, calculation notes, decision gate and next actions.
            </p>
            {persistedDraft ? (
              <p className="body-xs ct-text-faint">
                Persisted draft: {persistedDraft.vaultTicker} · updated{" "}
                {persistedDraft.updatedAtIso}
              </p>
            ) : null}
          </div>

          {scenarioSecondary ? (
            <div className="border-t ct-bc-soft pt-4 admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--start">
              <div className="admin-doc-stack admin-doc-stack--tight">
                <span className="stat-label">Secondary validation</span>
                <p className="body-sm ct-text-strong">
                  {secondaryHint ?? "Scenario Lab validation requested"}
                </p>
                <p className="body-xs ct-text-muted">
                  Keep this workspace as the product source of truth, then run Scenario
                  Lab as supporting evidence.
                </p>
              </div>
              <Button variant="secondary" size="sm" asChild>
                <Link href={buildScenarioLabHref(objective)}>Open Scenario Lab</Link>
              </Button>
            </div>
          ) : null}

          {/* Vault parameters — flat definition list */}
          <div className="border-t ct-bc-soft pt-4">
            <span className="stat-label mb-3 block">Vault parameters</span>
            <div className="admin-doc-stack admin-doc-stack--tight">
              <div className="admin-doc-inline-row admin-doc-inline-row--between">
                <span className="body-sm ct-text-muted">Inferred vault</span>
                <span className="body-sm ct-text-strong">
                  {inferredVault.label} · {inferredVault.ticker}
                </span>
              </div>
              <div className="admin-doc-inline-row admin-doc-inline-row--between">
                <span className="body-sm ct-text-muted">Base mode</span>
                <span className="body-sm ct-text-body">{inferredVault.baseMode}</span>
              </div>
              <div className="admin-doc-inline-row admin-doc-inline-row--between">
                <span className="body-sm ct-text-muted">APY range</span>
                <span className="body-sm ct-text-strong">
                  {inferredVault.apyTarget.low}–{inferredVault.apyTarget.high}%
                  <span className="body-xs ct-text-muted ml-2">Estimated · range only</span>
                </span>
              </div>
              <div className="admin-doc-inline-row admin-doc-inline-row--between">
                <span className="body-sm ct-text-muted">Methodology</span>
                <span className="body-sm ct-text-body">{inferredVault.methodologyVersion}</span>
              </div>
            </div>
          </div>

          {/* Decision gate — flat list, no card per lane */}
          <div className="border-t ct-bc-soft pt-4">
            <span className="stat-label mb-3 block">Decision gate</span>
            <div className="admin-doc-stack admin-doc-stack--tight">
              {DECISION_LANES.map((lane) => (
                <div
                  key={lane.label}
                  className="admin-doc-inline-row admin-doc-inline-row--start"
                >
                  <span className="body-sm ct-text-strong w-16 shrink-0">{lane.label}</span>
                  <span className="body-sm ct-text-muted">
                    {lane.status} — {lane.detail}
                  </span>
                </div>
              ))}
            </div>
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
          <div className="rounded-2xl border ct-bc-warning ct-status-warning-bg px-4 py-3">
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
          <Badge variant="default">Runtime charts</Badge>
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
              <div className="rounded-2xl border ct-bc-soft ct-surface-1 p-3">
                {spec.visual}
              </div>
              <p className="body-xs ct-text-strong">{spec.metric}</p>
              <p className="body-sm ct-text-muted">{spec.series}</p>
              <div className="border-t ct-bc-soft pt-3 admin-doc-stack admin-doc-stack--tight">
                <p className="body-xs ct-text-muted">{spec.note}</p>
                <p className="body-xs ct-text-faint">
                  Generated from methodology assumptions; attach external evidence before review.
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
