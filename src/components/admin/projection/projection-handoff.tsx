import { AdminSectionCard } from "@/components/admin/admin-page-shell";
import { buildMethodologyPanel } from "@/lib/projection/methodology-panel";
import {
  deriveProjectionInputDraft,
  productTypeLabel,
  bucketLabel,
} from "@/lib/projection/product-objective-draft";
import { buildProjectionInputPreset } from "@/lib/projection/projection-input-preset";

/**
 * Product Workspace → Projection input DRAFT block.
 *
 * Rendered only when the page was opened from the Product Workspace CTA
 * (`?from=product-workspace`). It is a PURE, READ-ONLY context surface: it shows
 * the carried objective, the keyword-derived input suggestions (product type,
 * buckets, notes), AND the methodology panel — the CONFIGURED assumptions the
 * admin must review before running. It NEVER triggers a run and NEVER pre-fills
 * business numbers — the study only starts when the admin clicks "Run Study"
 * below, with assumptions they have reviewed.
 */
export function ProjectionHandoff({
  objective,
}: {
  objective: string | null;
}) {
  const draft = deriveProjectionInputDraft(objective ?? "");
  const preset = buildProjectionInputPreset(objective ?? "");
  const methodology = buildMethodologyPanel();

  return (
    <AdminSectionCard
      ariaLabel="Projection input draft"
      title="Projection input draft"
    >
      <div className="flex flex-col gap-3 p-5">
        <div className="flex flex-col gap-1">
          <p className="ct-bento-label">Source</p>
          <p className="body-sm ct-text-body">Product Workspace</p>
        </div>

        <div className="flex flex-col gap-1">
          <p className="ct-bento-label">Objective</p>
          <p className="body-sm ct-text-body text-balance">
            {draft.objective || "No objective carried from the workspace."}
          </p>
        </div>

        {draft.suggestedProductType !== "unknown" ? (
          <div className="flex flex-col gap-1">
            <p className="ct-bento-label">Suggested product type</p>
            <p className="body-sm ct-text-body">
              {productTypeLabel(draft.suggestedProductType)}
            </p>
          </div>
        ) : null}

        {draft.suggestedBuckets.length > 0 ? (
          <div className="flex flex-col gap-1">
            <p className="ct-bento-label">Suggested structure</p>
            <p className="body-sm ct-text-body">
              {draft.suggestedBuckets.map(bucketLabel).join(" + ")}
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <p className="ct-bento-label">Status</p>
          <p className="body-sm ct-text-body">Draft suggestions only</p>
        </div>

        {draft.warnings.length > 0 ? (
          <ul className="flex list-disc flex-col gap-1 pl-4">
            {draft.warnings.map((w) => (
              <li key={w} className="ct-metric-caption leading-relaxed">
                {w}
              </li>
            ))}
          </ul>
        ) : null}

        {/* Projection preset — the honest split between what the workspace
            inferred (safe, non-numeric fields) and what the admin must still
            decide (review-required) / what is never prefilled from text
            (forbidden). NO business number is ever prepared here. */}
        <div className="flex flex-col gap-3 border-t border-[var(--ct-border)] pt-3">
          <p className="ct-bento-label">Projection preset from Product Workspace</p>

          <div className="flex flex-col gap-1">
            <p className="ct-metric-caption uppercase tracking-wider">
              Safe fields prepared
            </p>
            {preset.hasSafeFields ? (
              <ul className="flex list-disc flex-col gap-1 pl-4">
                {preset.safeFields.productTypeLabel ? (
                  <li className="body-sm ct-text-body">
                    Product type: {preset.safeFields.productTypeLabel}
                  </li>
                ) : null}
                {preset.safeFields.bucketLabels &&
                preset.safeFields.bucketLabels.length > 0 ? (
                  <li className="body-sm ct-text-body">
                    Buckets: {preset.safeFields.bucketLabels.join(", ")}
                  </li>
                ) : null}
                {preset.safeFields.label ? (
                  <li className="body-sm ct-text-body">
                    Label: {preset.safeFields.label}
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="ct-metric-caption leading-relaxed">
                None — the objective did not yield a safe structural field. Set
                the inputs manually.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <p className="ct-metric-caption uppercase tracking-wider">
              Review required (not prefilled)
            </p>
            <p className="body-sm ct-text-body">
              {preset.reviewRequired.join(" · ")}
            </p>
          </div>

          <p className="ct-metric-caption leading-relaxed">
            No business number is prepared from the objective (
            {preset.forbiddenPrefill.slice(0, 4).join(", ")}, …). Manual Run Study
            required.
          </p>
        </div>

        {/* Methodology panel — the CONFIGURED assumptions the admin must review
            before running. Read-only mirror of the in-code assumptions the engine
            uses; tagged CONFIGURED so it never reads as live/validated. */}
        <div className="flex flex-col gap-2 border-t border-[var(--ct-border)] pt-3">
          <div className="flex items-center justify-between">
            <p className="ct-bento-label">Assumptions to review</p>
            <span className="ct-metric-caption uppercase tracking-wider">
              {methodology.status} · methodology {methodology.methodologyVersion}
            </span>
          </div>
          <ul className="flex flex-col gap-1">
            {methodology.rows.map((row) => (
              <li
                key={row.label}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="body-sm ct-text-body">{row.label}</span>
                <span className="body-sm ct-text-body tabular-nums">
                  {row.value}
                </span>
              </li>
            ))}
          </ul>
          {methodology.notes.length > 0 ? (
            <ul className="flex list-disc flex-col gap-1 pl-4">
              {methodology.notes.map((n) => (
                <li key={n} className="ct-metric-caption leading-relaxed">
                  {n}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <p className="ct-metric-caption leading-relaxed">
          GO ADMIN ONLY · manual Run Study required · configured assumptions must
          be reviewed · projection, not guaranteed. Nothing has been run — opening
          this page from the workspace does not create any record.
        </p>
      </div>
    </AdminSectionCard>
  );
}
