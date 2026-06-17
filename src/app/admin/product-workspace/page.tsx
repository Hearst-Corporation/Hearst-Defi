import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ApyRange } from "@/components/ui/apy-range";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
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
  metric: React.ReactNode;
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
  "Headline APY stays a range; attach provenance before any publication.",
  "Mining yield remains estimated until partner attestation is on file.",
  "Distribution copy must state assumptions and a conditional-projection disclaimer.",
  "Scenario Lab stress-tests an already framed product — it does not create one here.",
] as const;

const NEXT_ACTIONS = [
  "Attach provenance for every published metric.",
  "If stress validation is needed, run Scenario Lab and record outputs in this workspace.",
  "Log the final human decision in governance or review notes.",
] as const;

const OUT_OF_MANDATE_RE =
  /\b(retail|public offer|auto.?execute|autonomous execution|no kyc|without kyc|bypass approval|bypass approvals|single point yield|fixed yield)\b/i;

const DECISION_LANES = [
  {
    label: "Proceed",
    status: "Draft ready",
    detail: "Objective, allocation bounds, and compliance posture are documented.",
  },
  {
    label: "Hold",
    status: "Evidence gap",
    detail: "Pause when provenance, legal wrapper, or partner attestation is incomplete.",
  },
  {
    label: "Reject",
    status: "Out of mandate",
    detail: "Autonomous execution, single-point yield, or retail access is required.",
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
        metric: (
          <>
            <ApyRange
              low={vault.apyTarget.low}
              high={vault.apyTarget.high}
              precision={1}
              className="body-xs ct-text-strong"
            />
            {" APY range"}
          </>
        ),
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

const ALLOC_COLORS = [
  "var(--ct-accent)",
  "var(--ct-status-info)",
  "var(--ct-status-warning)",
  "var(--ct-text-faint)",
] as const;

// Inline-SVG chart geometry — all three charts share viewBox "0 0 320 72".
// Computed coordinates are rounded so a series never leaks float noise like
// 31.8879999… into the rendered DOM. The drift / scale factors are illustrative
// presentation shaping (not vault data), named here instead of bare literals.
const round2 = (n: number): number => Math.round(n * 100) / 100;
const CHART_BAR_WIDTH = 320;
const DIST_X0 = 24;
const DIST_X_STEP = 24;
const DIST_BASELINE_Y = 52;
const DIST_Y_SCALE = 1.2;
const DIST_DRIFT_LOW = 0.12;
const DIST_DRIFT_HIGH = 0.16;
const STRESS_TROUGH_X = 152;

function AllocationStackChart({ vault }: { vault: VaultDefinition }) {
  let x = 0;
  return (
    <svg viewBox="0 0 320 72" role="img" aria-label={`${vault.ticker} allocation stack`} width="100%" style={{ height: "auto" }}>
      <rect x="0" y="24" width="320" height="18" rx="9" className="fill-(--ct-surface-1)" />
      {Object.entries(vault.allocationTargets).map(([bucket, weight], index) => {
        const width = round2((weight / 100) * CHART_BAR_WIDTH);
        const currentX = round2(x);
        x += width;
        return (
          <g key={bucket}>
            <rect
              x={currentX}
              y="24"
              width={width}
              height="18"
              rx="9"
              fill={ALLOC_COLORS[index] ?? "var(--ct-accent)"}
              style={{ opacity: "var(--ct-opacity-90)" }}
            />
            <text x={currentX + 4} y="58" className="fill-(--ct-text-muted) text-micro">
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
  const series = (apy: number, drift: number) =>
    months
      .map(
        (month) =>
          `${DIST_X0 + month * DIST_X_STEP},${round2(
            DIST_BASELINE_Y - (apy + month * drift) * DIST_Y_SCALE,
          )}`,
      )
      .join(" ");
  return (
    <svg viewBox="0 0 320 72" role="img" aria-label={`${vault.ticker} distribution range`} width="100%" style={{ height: "auto" }}>
      <polyline points={series(vault.apyTarget.high, DIST_DRIFT_HIGH)} fill="none" stroke="var(--ct-accent)" strokeWidth="2" />
      <polyline points={series(vault.apyTarget.low, DIST_DRIFT_LOW)} fill="none" stroke="var(--ct-status-info)" strokeWidth="2" />
      <line x1="24" y1="56" x2="288" y2="56" className="stroke-(--ct-border-soft)" />
      <text x="24" y="68" className="fill-(--ct-text-muted) text-micro">M1</text>
      <text x="266" y="68" className="fill-(--ct-text-muted) text-micro">M12</text>
    </svg>
  );
}

function StressCorridorChart({ vault }: { vault: VaultDefinition }) {
  const reserve = vault.allocationTargets.stable_reserve;
  const mining = vault.allocationTargets.mining;
  // Shock trough — one source, shared by the corridor vertex and the marker dot.
  const troughY = round2(40 - reserve * 0.12);
  const corridor = [
    `24,${round2(34 + mining * 0.18)}`,
    `88,${round2(30 + reserve * 0.08)}`,
    `${STRESS_TROUGH_X},${troughY}`,
    `216,${round2(34 - reserve * 0.08)}`,
    `288,${round2(28 - reserve * 0.05)}`,
  ].join(" ");
  return (
    <svg viewBox="0 0 320 72" role="img" aria-label={`${vault.ticker} stress corridor`} width="100%" style={{ height: "auto" }}>
      <polyline points={corridor} fill="none" stroke="var(--ct-status-warning)" strokeWidth="2.5" />
      <line x1="24" y1="54" x2="288" y2="54" className="stroke-(--ct-border-soft)" />
      <circle cx={STRESS_TROUGH_X} cy={troughY} r="4" fill="var(--ct-accent)" />
      <text x="24" y="68" className="fill-(--ct-text-muted) text-micro">Shock</text>
      <text x="232" y="68" className="fill-(--ct-text-muted) text-micro">Recovery</text>
    </svg>
  );
}

function decisionBadgeVariant(
  decision: (typeof DECISION_LANES)[number],
): "success" | "warning" | "danger" {
  switch (decision.label) {
    case "Proceed":
      return "success";
    case "Reject":
      return "danger";
    default:
      return "warning";
  }
}

function scenarioOutputs(objective: string | undefined): string[] {
  if (objective && isExplicitSimulationIntent(objective)) {
    return [
      "Scenario validation requested — Scenario Lab is supporting evidence only.",
      "Return APY range, drawdown estimate, monthly distribution range, and PTAI notes to this workspace.",
    ];
  }
  return [
    "No scenario output requested yet.",
    "Run Scenario Lab later if needed; paste results here as supporting evidence.",
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
    <div className="admin-doc-shell admin-doc-shell--roomy">
      <AdminPageHeader
        title="Product Workspace"
        eyebrow="Strategy"
        description="Frame a vault concept, record assumptions, and prepare supporting material before scenario validation."
        actions={
          <div className="admin-doc-inline-row admin-doc-inline-row--dense">
            <Badge variant={autostart ? "success" : "default"}>
              {autostart ? "Seeded by agent" : "Manual entry"}
            </Badge>
            {scenarioSecondary ? (
              <Badge variant="warning">Scenario validation queued</Badge>
            ) : null}
            <ProvenanceBadge kind="manual" compact />
          </div>
        }
      />

      <Card
        hoverOverlay={false}
        className="p-5 sm:p-7"
        contentClassName="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_240px] lg:gap-10"
      >
        <div className="flex flex-col gap-3">
          <p className="eyebrow">Objective</p>
          <p
            className={cn(
              "h2 ct-text-strong text-balance",
              !objective && "ct-text-muted italic"
            )}
          >
            {objective ?? "Awaiting objective from cockpit agent"}
          </p>
          <p className="body-sm ct-text-body mt-1">
            Frame and document only — no vault creation, allocations, or approvals from this surface.
          </p>
        </div>
        <div className="flex flex-col gap-3 lg:border-l lg:border-(--ct-border-soft) lg:pl-7">
          <div className="flex flex-col gap-2">
            <p className="stat-label">Execution Mandate</p>
            <Badge variant="accent" className="w-fit">Human-in-the-loop</Badge>
          </div>
          <div className="flex flex-col gap-2">
            <p className="stat-label">Decision Status</p>
            <Badge variant={decisionBadgeVariant(decision)} className="w-fit">
              {decision.label} — {decision.status}
            </Badge>
          </div>
        </div>
      </Card>

      <section aria-labelledby="pw-brief-heading" className="admin-doc-stack admin-doc-stack--tight">
        <div className="flex items-center gap-3">
          <span aria-hidden className="h-4 w-px rounded-full bg-(--ct-border-strong)" />
          <h2 id="pw-brief-heading" className="h2">Product inference</h2>
        </div>
        <Card hoverOverlay={false} contentClassName="grid grid-cols-1 lg:grid-cols-2">
          {/* Colonne 1: Inferred product line */}
          <div className="flex flex-col gap-6 p-6 sm:p-8 lg:border-r lg:border-(--ct-border-soft)">
            <div className="admin-doc-stack admin-doc-stack--tight">
              <div className="admin-doc-inline-row admin-doc-inline-row--between py-2 border-b border-(--ct-border-soft)">
                <span className="body-xs ct-text-muted">Vault</span>
                <span className="body-sm ct-text-strong">
                  {inferredVault.label} · {inferredVault.ticker}
                </span>
              </div>
              <div className="admin-doc-inline-row admin-doc-inline-row--between py-2 border-b border-(--ct-border-soft)">
                <span className="body-xs ct-text-muted">Base mode</span>
                <span className="body-sm ct-text-strong">{inferredVault.baseMode}</span>
              </div>
              <div className="admin-doc-inline-row admin-doc-inline-row--between py-2 border-b border-(--ct-border-soft)">
                <span className="body-xs ct-text-muted">APY range</span>
                <span className="body-sm ct-text-strong inline-flex items-baseline gap-x-2">
                  <ApyRange
                    low={inferredVault.apyTarget.low}
                    high={inferredVault.apyTarget.high}
                    precision={1}
                    className="body-sm ct-text-strong"
                  />
                </span>
              </div>
              <div className="admin-doc-inline-row admin-doc-inline-row--between py-2 border-b border-(--ct-border-soft)">
                <span className="body-xs ct-text-muted">Methodology</span>
                <span className="body-sm ct-text-strong">{inferredVault.methodologyVersion}</span>
              </div>
            </div>

            {persistedDraft ? (
              <div className="mt-1 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-(--ct-status-info)" />
                <p className="body-xs ct-text-faint">
                  Saved draft · {persistedDraft.vaultTicker} · {persistedDraft.updatedAtIso}
                </p>
              </div>
            ) : null}

            {scenarioSecondary ? (
              <div className="mt-auto pt-4 flex flex-col items-start gap-3">
                <p className="body-xs ct-text-muted">
                  {secondaryHint ?? "Scenario Lab validation requested"} — supporting evidence only.
                </p>
                <Button variant="secondary" size="sm" asChild>
                  <Link href={buildScenarioLabHref(objective)}>Open Scenario Lab</Link>
                </Button>
              </div>
            ) : null}
          </div>

          {/* Colonne 2: Calculation notes */}
          <div className="flex flex-col gap-6 p-6 sm:p-8">
            <p className="eyebrow">Calculation notes</p>
            <div className="admin-doc-stack admin-doc-stack--tight">
              {CALC_NOTES.map((note, idx) => (
                <div key={note} className="flex gap-3 py-1">
                  <span className="body-xs ct-text-faint mono mt-0.5">{String(idx + 1).padStart(2, "0")}</span>
                  <span className="body-sm ct-text-body">{note}</span>
                </div>
              ))}
            </div>
            <div className="mt-auto border-l-2 border-(--ct-status-warning) pl-4 py-2">
              <p className="stat-label ct-status-warning mb-1">Required disclaimer</p>
              <p className="body-xs ct-text-muted">
                Conditional projection — not a committed outcome. For professional / qualified investors only.
              </p>
            </div>
          </div>
        </Card>
      </section>

      <section aria-labelledby="pw-notes-heading" className="admin-doc-stack admin-doc-stack--tight">
        <div className="flex items-center gap-3">
          <span aria-hidden className="h-4 w-px rounded-full bg-(--ct-border-strong)" />
          <h2 id="pw-notes-heading" className="h2">Supporting material</h2>
        </div>
        <Card hoverOverlay={false} contentClassName="grid grid-cols-1 lg:grid-cols-3">
          {/* Col 1 */}
          <div className="flex flex-col gap-5 p-6 sm:p-8 lg:border-r lg:border-(--ct-border-soft)">
            <p className="eyebrow">Assumptions</p>
            <div className="admin-doc-stack admin-doc-stack--tight">
              {inferredVault.assumptions.map((assumption, idx) => (
                <div key={assumption} className="flex gap-3 py-2 border-b border-(--ct-border-soft) last:border-0">
                  <span className="body-xs ct-text-faint mono mt-0.5">{idx + 1}.</span>
                  <span className="body-sm ct-text-body">{assumption}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Col 2 */}
          <div className="flex flex-col gap-5 p-6 sm:p-8 lg:border-r lg:border-(--ct-border-soft)">
            <p className="eyebrow">Scenario Outputs</p>
            <div className="admin-doc-stack admin-doc-stack--tight">
              {scenarioOutputNotes.map((note, idx) => (
                <div key={note} className="flex gap-3 py-2 border-b border-(--ct-border-soft) last:border-0">
                  <span className="body-xs ct-text-faint mono mt-0.5">{idx + 1}.</span>
                  <span className="body-sm ct-text-body">{note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Col 3 */}
          <div className="flex flex-col gap-5 p-6 sm:p-8">
            <p className="eyebrow">Next Actions</p>
            <div className="admin-doc-stack admin-doc-stack--tight">
              {NEXT_ACTIONS.map((action, idx) => (
                <div key={action} className="flex items-start gap-3 py-1">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm ct-surface-2 body-xs mono ct-text-strong mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="body-sm ct-text-body">{action}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </section>

      {/* L2 — Chart pack for review */}
      <section aria-labelledby="pw-graphs-heading" className="admin-doc-stack admin-doc-stack--tight">
        <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--start">
          <div className="flex items-center gap-3">
            <span aria-hidden className="h-4 w-px rounded-full bg-(--ct-border-strong)" />
            <h2 id="pw-graphs-heading" className="h2">
              Charts to attach
            </h2>
          </div>
          <Badge variant="default">Estimated visuals</Badge>
        </div>

        <div className="admin-doc-card-grid-3">
          {graphSpecs.map((spec) => (
            <Card
              key={spec.title}
              hoverOverlay={false}
              className="p-6"
              contentClassName="flex flex-col gap-5"
            >
              <div className="admin-doc-inline-row admin-doc-inline-row--between items-start">
                <div className="flex flex-col gap-1">
                  <p className="eyebrow">{spec.chart}</p>
                  <CardTitle>{spec.title}</CardTitle>
                </div>
                <ProvenanceBadge kind="estimated" compact />
              </div>
              <div className="admin-doc-inset">{spec.visual}</div>
              <div className="flex flex-col gap-1">
                <p className="body-xs ct-text-strong">{spec.metric}</p>
                <p className="body-sm ct-text-muted">{spec.series}</p>
              </div>
              <div className="admin-doc-divider-section flex flex-col gap-2">
                <p className="body-xs ct-text-muted">{spec.note}</p>
                <p className="body-xs ct-text-faint">
                  Illustrative from methodology assumptions. Attach external evidence
                  before review.
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
