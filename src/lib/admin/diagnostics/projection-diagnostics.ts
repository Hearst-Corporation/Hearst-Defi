/**
 * Projection diagnostics — exercises the REAL pure preset builder
 * (buildProjectionInputPreset) + methodology version. DB-write paths
 * (runProjectionStudy, promoteStudyToDraft) and the module-private run schema
 * are NOT exercised — they are SKIPPED honestly (no transaction-rollback seam
 * and the schema is not exported), never faked.
 */
import { buildProjectionInputPreset } from "@/lib/projection/projection-input-preset";
import { PROJECTION_METHODOLOGY_VERSION } from "@/lib/projection/methodology-panel";
import {
  type DiagnosticCheckSpec,
  type DiagnosticResult,
  fail,
  pass,
  runChecks,
  skip,
} from "./types";

const PRESET = "src/lib/projection/projection-input-preset.ts";
const ACTIONS = "src/app/admin/projection/actions.ts";

/** Numeric run-input keys that must NEVER appear prefilled in the preset. */
const NUMERIC_RUN_KEYS = [
  "btc_price_change_pct",
  "hashprice_usd_th_day",
  "energy_cost_kwh",
  "stable_apy_pct",
  "vol_index",
  "apy",
  "ltv",
];

export function runProjectionDiagnostics(): DiagnosticResult[] {
  const specs: DiagnosticCheckSpec[] = [
    {
      id: "proj.preset-structural-only",
      label: "Preset returns only structural (non-numeric) fields",
      severity: "P0",
      expected: "safeFields keys ⊆ {label,description,productType,productTypeLabel,buckets,bucketLabels,notes}",
      likelyFile: PRESET,
      likelyFunction: "buildProjectionInputPreset",
      run: () => {
        const p = buildProjectionInputPreset(
          "Mining-backed stablecoin yield product targeting 15% APY",
        );
        const allowed = new Set([
          "label",
          "description",
          "productType",
          "productTypeLabel",
          "buckets",
          "bucketLabels",
          "notes",
        ]);
        const stray = Object.keys(p.safeFields).filter((k) => !allowed.has(k));
        return stray.length === 0
          ? pass(`safeFields keys: ${Object.keys(p.safeFields).join(", ") || "(none)"}`, p.safeFields)
          : fail(`unexpected safeFields keys: ${stray.join(", ")}`);
      },
    },
    {
      id: "proj.no-numeric-prefill",
      label: "Objective with numbers does not prefill numeric business fields",
      severity: "P0",
      expected: "no btc/hashprice/energy/stable_apy/vol/apy/ltv field present in safeFields",
      likelyFile: PRESET,
      run: () => {
        const p = buildProjectionInputPreset(
          "Mining-backed stablecoin yield product targeting 15% APY, 60% LTV",
        );
        const leaked = NUMERIC_RUN_KEYS.filter(
          (k) => k in (p.safeFields as Record<string, unknown>),
        );
        return leaked.length === 0
          ? pass("no numeric run-input field prefilled (digits ignored by keyword parser)")
          : fail(`numeric fields leaked: ${leaked.join(", ")}`);
      },
    },
    {
      id: "proj.opaque-no-safe-fields",
      label: "Opaque objective infers no structural fields",
      severity: "P1",
      expected: "hasSafeFields = false; no productType/buckets/label inferred (a generic notes disclaimer is allowed)",
      likelyFile: PRESET,
      run: () => {
        const p = buildProjectionInputPreset("something vague and unstructured");
        const structural = [
          "productType",
          "productTypeLabel",
          "buckets",
          "bucketLabels",
          "label",
          "description",
        ].filter((k) => k in (p.safeFields as Record<string, unknown>));
        return p.hasSafeFields === false && structural.length === 0
          ? pass(
              `hasSafeFields=false; no structural fields inferred (keys: ${Object.keys(p.safeFields).join(", ") || "none"})`,
              p,
            )
          : fail(`hasSafeFields=${p.hasSafeFields}, structural keys: ${structural.join(", ")}`);
      },
    },
    {
      id: "proj.review-forbidden-lists",
      label: "Preset always carries review-required (11) + forbidden-prefill (15) lists",
      severity: "P1",
      expected: "reviewRequired.length=11, forbiddenPrefill.length=15",
      likelyFile: PRESET,
      run: () => {
        const p = buildProjectionInputPreset("anything");
        return p.reviewRequired.length === 11 && p.forbiddenPrefill.length === 15
          ? pass(`reviewRequired=${p.reviewRequired.length}, forbiddenPrefill=${p.forbiddenPrefill.length}`)
          : fail(`reviewRequired=${p.reviewRequired.length}, forbiddenPrefill=${p.forbiddenPrefill.length}`);
      },
    },
    {
      id: "proj.methodology-version",
      label: "Methodology version is surfaced (v1.0) and matches the preset",
      severity: "P2",
      expected: 'PROJECTION_METHODOLOGY_VERSION === preset.methodologyVersion === "v1.0"',
      likelyFile: "src/lib/projection/methodology-panel.ts",
      run: () => {
        const p = buildProjectionInputPreset("anything");
        return PROJECTION_METHODOLOGY_VERSION === "v1.0" &&
          p.methodologyVersion === "v1.0"
          ? pass(`methodologyVersion=${p.methodologyVersion}`)
          : fail(`const=${PROJECTION_METHODOLOGY_VERSION}, preset=${p.methodologyVersion}`);
      },
    },
    {
      id: "proj.get-creates-no-run",
      label: "Projection GET creates no ProjectionStudyRun",
      severity: "P0",
      expected: "GET render is side-effect free; runProjectionStudy is the only writer",
      likelyFile: "src/app/admin/projection/page.tsx",
      sideEffect: "skipped",
      run: () =>
        skip(
          "SKIPPED — verifying a GET creates no row needs a runtime+DB exercise with rollback (no seam). Source-verified separately: page.tsx awaits read-only loaders only.",
        ),
    },
    {
      id: "proj.run-is-db-write",
      label: "runProjectionStudy is a manual admin DB-write, not a chat tool",
      severity: "P0",
      expected: "runProjectionStudy writes ProjectionStudyRun + ScenarioRun behind requireAdmin",
      likelyFile: ACTIONS,
      likelyFunction: "runProjectionStudy",
      sideEffect: "skipped",
      run: () =>
        skip(
          "SKIPPED — calling runProjectionStudy is a DB-write (prisma.projectionStudyRun.create); not exercised without a rollback seam. It is a 'use server' action gated by requireAdmin, never in the chat tool registry.",
        ),
    },
    {
      id: "proj.run-schema-requires-assumptions",
      label: "Manual run schema requires financial assumptions",
      severity: "P1",
      expected: "ScenarioInputsSchema requires 5 business numbers",
      likelyFile: ACTIONS,
      sideEffect: "skipped",
      run: () =>
        skip(
          "SKIPPED — RunProjectionStudyInputSchema/ScenarioInputsSchema are module-private (not exported), so the real schema cannot be imported/asserted. Re-declaring it locally would be a fake test.",
        ),
    },
    {
      id: "proj.promote-separate",
      label: "Promote-to-draft is a separate action from Run Study",
      severity: "P2",
      expected: "promoteStudyToDraft is a distinct Server Action (writes VaultDeployment draft)",
      likelyFile: ACTIONS,
      likelyFunction: "promoteStudyToDraft",
      sideEffect: "skipped",
      run: () =>
        skip(
          "SKIPPED — promoteStudyToDraft is a separate DB-write Server Action; not exercised without a rollback seam. Distinct from runProjectionStudy (source-verified).",
        ),
    },
    {
      id: "proj.investor-ready-gate",
      label: "Investor-ready gate is not lifted by a run",
      severity: "P0",
      expected: "a ProjectionStudyRun does not flip a vault to investor-ready",
      likelyFile: ACTIONS,
      sideEffect: "skipped",
      run: () =>
        skip(
          "SKIPPED — requires a real run + deployment-state inspection (DB-write). The investor-ready gate is a separate state machine, not a run side-effect (source-verified).",
        ),
    },
  ];
  return runChecks("projection", specs);
}
