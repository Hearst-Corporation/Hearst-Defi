"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  createAgentTemplate,
  updateAgentTemplate,
} from "@/app/admin/agents/actions";
import type { AgentTemplate } from "@prisma/client";
import {
  BASE_AGENTS,
  BASE_AGENT_LABELS,
  TONES,
  LANGUAGES,
  VERBOSITIES,
} from "@/lib/agents/agent-template-constants";

/** Create + edit form for an AgentTemplate (the reusable persona library). */
export function AgentTemplateForm({ template }: { template?: AgentTemplate }) {
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(template);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        if (template) {
          await updateAgentTemplate(template.id, formData);
        } else {
          await createAgentTemplate(formData);
        }
        // On success the action redirects; toast only fires on error.
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Save failed: ${message}`);
      }
    });
  }

  return (
    <form action={onSubmit} className="admin-doc-stack admin-doc-stack--actions" aria-label="Agent template form">
      <label className="block body-xs" htmlFor="tpl-label">
        <span className="ct-form-label">Label</span>
        <input
          id="tpl-label"
          name="label"
          type="text"
          required
          defaultValue={template?.label ?? ""}
          placeholder="LP institutionnel FR"
          className="ct-input"
        />
      </label>

      <label className="block body-xs" htmlFor="tpl-description">
        <span className="ct-form-label">Description (optional)</span>
        <input
          id="tpl-description"
          name="description"
          type="text"
          defaultValue={template?.description ?? ""}
          placeholder="Investisseur institutionnel, registre feutré, FR"
          className="ct-input"
        />
      </label>

      <div className="admin-doc-form-grid-2">
        <label className="block body-xs" htmlFor="tpl-baseAgent">
          <span className="ct-form-label">Base agent</span>
          <select
            id="tpl-baseAgent"
            name="baseAgent"
            defaultValue={template?.baseAgent ?? "cockpit-chat"}
            className="ct-input"
          >
            {BASE_AGENTS.map((a) => (
              <option key={a} value={a}>
                {BASE_AGENT_LABELS[a] ?? a}
              </option>
            ))}
          </select>
        </label>

        <label className="block body-xs" htmlFor="tpl-language">
          <span className="ct-form-label">Language</span>
          <select
            id="tpl-language"
            name="language"
            defaultValue={template?.language ?? ""}
            className="ct-input"
          >
            <option value="">— default —</option>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="admin-doc-form-grid-2">
        <label className="block body-xs" htmlFor="tpl-tone">
          <span className="ct-form-label">Tone</span>
          <select
            id="tpl-tone"
            name="tone"
            defaultValue={template?.tone ?? ""}
            className="ct-input"
          >
            <option value="">— default —</option>
            {TONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="block body-xs" htmlFor="tpl-verbosity">
          <span className="ct-form-label">Verbosity</span>
          <select
            id="tpl-verbosity"
            name="verbosity"
            defaultValue={template?.verbosity ?? ""}
            className="ct-input"
          >
            <option value="">— default —</option>
            {VERBOSITIES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block body-xs" htmlFor="tpl-systemAdditions">
        <span className="ct-form-label">Tone & behavior notes</span>
        <textarea
          id="tpl-systemAdditions"
          name="systemAdditions"
          rows={5}
          defaultValue={template?.systemAdditions ?? ""}
          placeholder="Mets en avant la structure Cayman SPV et la conformité ; registre feutré."
          className="ct-input"
        />
      </label>

      <div className="admin-doc-inline-row">
        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Create template"}
        </Button>
      </div>
    </form>
  );
}
