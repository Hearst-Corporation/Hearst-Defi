"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { assignTemplate, recalibrateAgent } from "@/app/admin/customers/[id]/actions";
import type { AgentTemplate } from "@prisma/client";

/**
 * Assigns the AgentTemplate a customer's cockpit-chat inherits, plus a button
 * to recompute the persona from the stored qualification answers.
 *
 * `templates` contains only active templates (from loadActiveTemplates). When
 * the customer's current template is archived it won't appear in that list, so
 * we accept it separately and render it as a disabled option so the current
 * state remains visible and understandable.
 */
export function AgentAssignForm({
  investorId,
  userId,
  templates,
  currentTemplateId,
  currentTemplate,
  canRecalibrate,
}: {
  investorId: string;
  userId: string;
  /** Active templates only (from loadActiveTemplates). */
  templates: AgentTemplate[];
  currentTemplateId: string | null;
  /** The currently assigned template — may be archived and absent from `templates`. */
  currentTemplate?: AgentTemplate | null;
  canRecalibrate: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  // If the current template is archived it's not in the active list — add it so
  // the selected option renders correctly.
  const archivedCurrent =
    currentTemplate?.archived &&
    !templates.some((t) => t.id === currentTemplate.id)
      ? currentTemplate
      : null;

  function onAssign(formData: FormData) {
    startTransition(async () => {
      try {
        await assignTemplate(investorId, formData);
        toast.success("Template assigned");
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Assign failed: ${message}`);
      }
    });
  }

  function onRecalibrate(formData: FormData) {
    startTransition(async () => {
      try {
        await recalibrateAgent(investorId, formData);
        toast.success("Agent recalibrated from questionnaire");
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Recalibrate failed: ${message}`);
      }
    });
  }

  return (
    <div className="admin-doc-stack admin-doc-stack--actions">
      <form action={onAssign} className="admin-doc-inline-row admin-form-row flex-wrap" aria-label="Assign template">
        <input type="hidden" name="userId" value={userId} />
        <label className="block body-xs grow" htmlFor="assign-template">
          <span className="ct-form-label">Inherited template</span>
          <select
            id="assign-template"
            name="templateId"
            defaultValue={currentTemplateId ?? ""}
            className="ct-input"
          >
            <option value="">— none —</option>
            {archivedCurrent && (
              <option key={archivedCurrent.id} value={archivedCurrent.id} disabled>
                {archivedCurrent.label} (archived)
              </option>
            )}
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="secondary" size="md" disabled={isPending}>
          Assign
        </Button>
      </form>

      <form action={onRecalibrate} aria-label="Recalibrate from questionnaire">
        <input type="hidden" name="userId" value={userId} />
        <Button type="submit" variant="primary" size="md" disabled={isPending || !canRecalibrate}>
          Recalibrate from questionnaire
        </Button>
        {!canRecalibrate && (
          <p className="body-xs ct-text-muted mt-1">
            No questionnaire answers yet — fill the qualification above first.
          </p>
        )}
      </form>
    </div>
  );
}
