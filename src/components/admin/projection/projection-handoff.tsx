import { AdminSectionCard } from "@/components/admin/admin-page-shell";

/**
 * Product Workspace → Projection handoff context block.
 *
 * Rendered only when the page was opened from the Product Workspace CTA
 * (`?from=product-workspace`). It is a PURE context surface: it shows the
 * carried objective and reminds the admin that the next step is a MANUAL run.
 * It never triggers `runProjectionStudy` and never pre-runs anything — the
 * study only starts when the admin clicks "Run Study" in the studio below.
 */
export function ProjectionHandoff({
  objective,
}: {
  objective: string | null;
}) {
  return (
    <AdminSectionCard
      ariaLabel="Product Workspace handoff"
      title="Product Workspace handoff"
    >
      <div className="flex flex-col gap-2 p-5">
        <p className="ct-bento-label">Objective</p>
        <p className="body-sm ct-text-body text-balance">
          {objective ?? "No objective carried from the workspace."}
        </p>
        <p className="ct-metric-caption leading-relaxed">
          Admin only · manual run required · projection, not guaranteed.
          Next step: review the configured assumptions below, then run the study
          manually. Nothing has been run — opening this page from the workspace
          does not create any record.
        </p>
      </div>
    </AdminSectionCard>
  );
}
