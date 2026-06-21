"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  createAgentTemplate,
  updateAgentTemplate,
} from "@/app/admin/agents/actions";
import type { AgentTemplate } from "@prisma/client";
import { AGENT_CATALOG } from "@/lib/agents/agent-catalog";
import { AGENT_ICONS } from "@/lib/agents/agent-icons";
import {
  BASE_AGENTS,
  BASE_AGENT_LABELS,
  TONES,
  LANGUAGES,
  VERBOSITIES,
  type BaseAgent,
} from "@/lib/agents/agent-template-constants";

/** Mirror of the server-side Zod cap on systemAdditions. */
const SYSTEM_ADDITIONS_MAX = 2000;

/** Create + edit form for an AgentTemplate (the reusable persona library). */
export function AgentTemplateForm({
  template,
  initialBaseAgent,
}: {
  template?: AgentTemplate;
  initialBaseAgent?: BaseAgent;
}) {
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(template);

  // Live state — the catalog + constants are client-safe (no Prisma), so the
  // selected agent's context renders without any server round-trip.
  const [baseAgent, setBaseAgent] = useState<BaseAgent>(
    (template?.baseAgent as BaseAgent) ?? initialBaseAgent ?? "cockpit-chat",
  );
  const [tone, setTone] = useState(template?.tone ?? "");
  const [language, setLanguage] = useState(template?.language ?? "");
  const [verbosity, setVerbosity] = useState(template?.verbosity ?? "");
  const [systemLen, setSystemLen] = useState(
    (template?.systemAdditions ?? "").length,
  );

  const entry = AGENT_CATALOG.find((e) => e.baseAgent === baseAgent);
  // Index the shared map directly (not via a helper) so the React compiler
  // treats Icon as a stable component reference, not one created at render.
  const Icon = entry ? AGENT_ICONS[entry.icon] : AGENT_ICONS.chat;
  const systemOver = systemLen > SYSTEM_ADDITIONS_MAX;

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
    <form
      action={onSubmit}
      className="admin-doc-stack"
      aria-label="Agent template form"
    >
      {/* Selected base agent — echoes the catalog card you arrived from. */}
      {entry && (
        <div className="admin-doc-inline-row admin-doc-inline-row--start admin-inset-panel--md border border-(--ct-border-soft)">
          <span
            aria-hidden
            className="admin-inset-chip flex size-12 shrink-0 items-center justify-center border border-(--ct-border-accent) bg-(--ct-accent-soft) ct-text-accent"
          >
            <Icon className="size-6" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block stat-label ct-text-muted">Base agent</span>
            <span className="block body-sm font-semibold ct-text-strong">
              {entry.label}
            </span>
            <span className="block body-xs ct-text-muted">{entry.description}</span>
          </span>
          <Badge variant={entry.scope === "platform" ? "accent" : "default"}>
            {entry.scopeLabel}
          </Badge>
        </div>
      )}

      {/* ── Section 1 · Identity ──────────────────────────────────────── */}
      <section
        className="admin-doc-stack admin-doc-stack--actions"
        aria-labelledby="sec-identity"
      >
        <header>
          <h3 id="sec-identity" className="body-sm font-semibold ct-text-strong">
            Identity
          </h3>
          <p className="body-xs ct-text-muted">
            How this persona appears in the library.
          </p>
        </header>

        <label className="block body-xs" htmlFor="tpl-label">
          <span className="ct-form-label">
            Label <span aria-hidden className="ct-text-accent">*</span>
          </span>
          <input
            id="tpl-label"
            name="label"
            type="text"
            required
            minLength={2}
            maxLength={80}
            defaultValue={template?.label ?? ""}
            placeholder="Institutional LP"
            className="ct-input"
          />
          <span className="admin-field-hint block body-xs ct-text-muted">
            2–80 characters. Used to generate the slug.
          </span>
        </label>

        <label className="block body-xs" htmlFor="tpl-description">
          <span className="ct-form-label">
            Description <span className="ct-text-muted">(optional)</span>
          </span>
          <input
            id="tpl-description"
            name="description"
            type="text"
            maxLength={2000}
            defaultValue={template?.description ?? ""}
            placeholder="Institutional investor, muted register"
            className="ct-input"
          />
        </label>
      </section>

      {/* ── Section 2 · Behavior ──────────────────────────────────────── */}
      <section
        className="admin-doc-stack admin-doc-stack--actions"
        aria-labelledby="sec-behavior"
      >
        <header>
          <h3 id="sec-behavior" className="body-sm font-semibold ct-text-strong">
            Behavior
          </h3>
          <p className="body-xs ct-text-muted">
            Base agent and response register. Leave blank to inherit the agent
            defaults.
          </p>
        </header>

        <label className="block body-xs" htmlFor="tpl-baseAgent">
          <span className="ct-form-label">
            Base agent <span aria-hidden className="ct-text-accent">*</span>
          </span>
          <select
            id="tpl-baseAgent"
            name="baseAgent"
            value={baseAgent}
            onChange={(e) => setBaseAgent(e.target.value as BaseAgent)}
            className="ct-input"
          >
            {BASE_AGENTS.map((a) => (
              <option key={a} value={a}>
                {BASE_AGENT_LABELS[a] ?? a}
              </option>
            ))}
          </select>
        </label>

        <div className="admin-doc-form-grid-2">
          <label className="block body-xs" htmlFor="tpl-tone">
            <span className="ct-form-label">Tone</span>
            <select
              id="tpl-tone"
              name="tone"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
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

          <label className="block body-xs" htmlFor="tpl-language">
            <span className="ct-form-label">Language</span>
            <select
              id="tpl-language"
              name="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="ct-input"
            >
              <option value="">— default —</option>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          <label className="block body-xs" htmlFor="tpl-verbosity">
            <span className="ct-form-label">Verbosity</span>
            <select
              id="tpl-verbosity"
              name="verbosity"
              value={verbosity}
              onChange={(e) => setVerbosity(e.target.value)}
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
      </section>

      {/* ── Section 3 · Instructions ──────────────────────────────────── */}
      <section
        className="admin-doc-stack admin-doc-stack--actions"
        aria-labelledby="sec-instructions"
      >
        <header>
          <h3
            id="sec-instructions"
            className="body-sm font-semibold ct-text-strong"
          >
            Instructions
          </h3>
          <p className="body-xs ct-text-muted">
            Appended verbatim to the system prompt. Never promise returns.
          </p>
        </header>

        <label className="block body-xs" htmlFor="tpl-systemAdditions">
          <span className="ct-form-label">Tone &amp; behavior notes</span>
          <textarea
            id="tpl-systemAdditions"
            name="systemAdditions"
            rows={6}
            maxLength={SYSTEM_ADDITIONS_MAX}
            defaultValue={template?.systemAdditions ?? ""}
            onChange={(e) => setSystemLen(e.target.value.length)}
            placeholder="Highlight the Cayman SPV structure and compliance; muted register."
            className="ct-input"
          />
          <span
            aria-live="polite"
            className={`admin-field-hint block text-right body-xs ${
              systemOver ? "ct-status-danger" : "ct-text-muted"
            }`}
          >
            {systemLen} / {SYSTEM_ADDITIONS_MAX}
          </span>
        </label>
      </section>

      {/* Live persona preview — the exact register this template encodes. */}
      <div
        className="admin-doc-inline-row admin-doc-inline-row--start"
        aria-label="Persona summary"
      >
        <span className="stat-label ct-text-muted">Persona</span>
        <Badge variant={entry?.scope === "platform" ? "accent" : "default"}>
          {BASE_AGENT_LABELS[baseAgent] ?? baseAgent}
        </Badge>
        {tone && <Badge variant="default">{tone}</Badge>}
        {language && <Badge variant="default">{language.toUpperCase()}</Badge>}
        {verbosity && <Badge variant="default">{verbosity}</Badge>}
      </div>

      <div className="admin-doc-inline-row">
        <Button type="submit" variant="primary" size="md" disabled={isPending || systemOver}>
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Create template"}
        </Button>
      </div>
    </form>
  );
}
