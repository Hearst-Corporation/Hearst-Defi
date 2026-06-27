"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import {
  BentoLabel,
  BENTO_PRIMARY_BTN,
  BENTO_SECONDARY_BTN,
} from "@/components/ui/bento";
import { assignTemplate, recalibrateAgent } from "@/app/admin/customers/[id]/actions";
import type { AgentTemplate } from "@prisma/client";

const SELECT_INPUT =
  "bg-[#15191C] border border-white/10 focus:border-[#A7FB90]/40 text-white rounded-lg px-4 py-2.5 text-[13px] outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

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
    <div className="flex flex-col gap-5">
      <form
        action={onAssign}
        className="flex flex-wrap items-end gap-3"
        aria-label="Assign template"
      >
        <input type="hidden" name="userId" value={userId} />
        <label className="flex grow flex-col gap-2" htmlFor="assign-template">
          <BentoLabel>Inherited template</BentoLabel>
          <select
            id="assign-template"
            name="templateId"
            defaultValue={currentTemplateId ?? ""}
            className={SELECT_INPUT}
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
        <button type="submit" className={BENTO_SECONDARY_BTN} disabled={isPending}>
          Assign
        </button>
      </form>

      <form action={onRecalibrate} aria-label="Recalibrate from questionnaire">
        <input type="hidden" name="userId" value={userId} />
        <button
          type="submit"
          className={BENTO_PRIMARY_BTN}
          disabled={isPending || !canRecalibrate}
        >
          Recalibrate from questionnaire
        </button>
        {!canRecalibrate && (
          <p className="mt-2 text-[12px] text-zinc-500">
            No questionnaire answers yet — fill the qualification above first.
          </p>
        )}
      </form>
    </div>
  );
}
