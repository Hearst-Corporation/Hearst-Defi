import { AdminSectionCard } from "@/components/admin/admin-page-shell";
import {
  deriveProjectionInputDraft,
  productTypeLabel,
  bucketLabel,
} from "@/lib/projection/product-objective-draft";

/**
 * Product Workspace → Projection input DRAFT block.
 *
 * Rendered only when the page was opened from the Product Workspace CTA
 * (`?from=product-workspace`). It is a PURE, READ-ONLY context surface: it shows
 * the carried objective and the keyword-derived input suggestions (product type,
 * buckets, notes) so the admin can orient the studio faster. It NEVER triggers a
 * run and NEVER pre-fills business numbers — the study only starts when the admin
 * clicks "Run Study" below, with assumptions they have reviewed.
 */
export function ProjectionHandoff({
  objective,
}: {
  objective: string | null;
}) {
  const draft = deriveProjectionInputDraft(objective ?? "");

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

        <p className="ct-metric-caption leading-relaxed">
          GO ADMIN ONLY · manual Run Study required · configured assumptions must
          be reviewed · projection, not guaranteed. Nothing has been run — opening
          this page from the workspace does not create any record.
        </p>
      </div>
    </AdminSectionCard>
  );
}
