"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createAgentTemplate,
  updateAgentTemplate,
} from "@/app/admin/agents/actions";
import type { AgentTemplate } from "@prisma/client";
import { BENTO_PRIMARY_BTN } from "@/components/ui/bento";
import { cn } from "@/lib/cn";
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

/** Micro uppercase field label — bento canon. */
const FIELD_LABEL =
  "text-[length:var(--ct-text-nano)] uppercase tracking-[0.15em] font-bold text-[var(--ct-text-faint)]";

/** Native input/select/textarea chrome — bento canon. */
const FIELD_CONTROL =
  "w-full bg-surface-inset border border-[var(--ct-border)] focus:border-[color-mix(in_srgb,var(--ct-accent)_40%,transparent)] focus:outline-none rounded-lg px-4 py-2.5 text-[length:var(--ct-text-xs)] text-white placeholder:text-[var(--ct-text-faint)]";

/** Neutral badge pill used in the persona summary + base-agent echo. */
function Pill({
  accent = false,
  children,
}: {
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[length:var(--ct-text-nano)] font-bold uppercase tracking-wider",
        accent
          ? "border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[var(--ct-accent)]"
          : "border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] text-[var(--ct-text-muted)]",
      )}
    >
      {children}
    </span>
  );
}

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
      className="flex flex-col gap-y-6"
      aria-label="Agent template form"
    >
      {/* Selected base agent — echoes the catalog card you arrived from. */}
      {entry && (
        <div className="flex items-center gap-4 rounded-2xl border border-[var(--ct-border)] bg-surface-inset p-5">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[var(--ct-accent)]"
          >
            <Icon className="size-6" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn("block", FIELD_LABEL)}>Base agent</span>
            <span className="block text-[14px] font-semibold text-white">
              {entry.label}
            </span>
            <span className="block text-[length:var(--ct-text-2xs)] text-[var(--ct-text-muted)]">
              {entry.description}
            </span>
          </span>
          <Pill accent={entry.scope === "platform"}>{entry.scopeLabel}</Pill>
        </div>
      )}

      {/* ── Section 1 · Identity ──────────────────────────────────────── */}
      <section className="flex flex-col gap-y-4" aria-labelledby="sec-identity">
        <header className="flex flex-col gap-1">
          <h3
            id="sec-identity"
            className="text-[length:var(--ct-text-micro)] font-bold text-[var(--ct-text-muted)] uppercase tracking-[0.15em] leading-none"
          >
            Identity
          </h3>
          <p className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)]">
            How this persona appears in the library.
          </p>
        </header>

        <label className="flex flex-col gap-1.5" htmlFor="tpl-label">
          <span className={FIELD_LABEL}>
            Label{" "}
            <span aria-hidden className="text-[var(--ct-accent)]">
              *
            </span>
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
            className={FIELD_CONTROL}
          />
          <span className="text-[length:var(--ct-text-micro)] text-[var(--ct-text-faint)]">
            2–80 characters. Used to generate the slug.
          </span>
        </label>

        <label className="flex flex-col gap-1.5" htmlFor="tpl-description">
          <span className={FIELD_LABEL}>
            Description <span className="text-[var(--ct-text-faint)]">(optional)</span>
          </span>
          <input
            id="tpl-description"
            name="description"
            type="text"
            maxLength={2000}
            defaultValue={template?.description ?? ""}
            placeholder="Institutional investor, muted register"
            className={FIELD_CONTROL}
          />
        </label>
      </section>

      {/* ── Section 2 · Behavior ──────────────────────────────────────── */}
      <section className="flex flex-col gap-y-4" aria-labelledby="sec-behavior">
        <header className="flex flex-col gap-1">
          <h3
            id="sec-behavior"
            className="text-[length:var(--ct-text-micro)] font-bold text-[var(--ct-text-muted)] uppercase tracking-[0.15em] leading-none"
          >
            Behavior
          </h3>
          <p className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)]">
            Base agent and response register. Leave blank to inherit the agent
            defaults.
          </p>
        </header>

        <label className="flex flex-col gap-1.5" htmlFor="tpl-baseAgent">
          <span className={FIELD_LABEL}>
            Base agent{" "}
            <span aria-hidden className="text-[var(--ct-accent)]">
              *
            </span>
          </span>
          <select
            id="tpl-baseAgent"
            name="baseAgent"
            value={baseAgent}
            onChange={(e) => setBaseAgent(e.target.value as BaseAgent)}
            className={FIELD_CONTROL}
          >
            {BASE_AGENTS.map((a) => (
              <option key={a} value={a}>
                {BASE_AGENT_LABELS[a] ?? a}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1.5" htmlFor="tpl-tone">
            <span className={FIELD_LABEL}>Tone</span>
            <select
              id="tpl-tone"
              name="tone"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className={FIELD_CONTROL}
            >
              <option value="">— default —</option>
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5" htmlFor="tpl-language">
            <span className={FIELD_LABEL}>Language</span>
            <select
              id="tpl-language"
              name="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={FIELD_CONTROL}
            >
              <option value="">— default —</option>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5" htmlFor="tpl-verbosity">
            <span className={FIELD_LABEL}>Verbosity</span>
            <select
              id="tpl-verbosity"
              name="verbosity"
              value={verbosity}
              onChange={(e) => setVerbosity(e.target.value)}
              className={FIELD_CONTROL}
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
        className="flex flex-col gap-y-4"
        aria-labelledby="sec-instructions"
      >
        <header className="flex flex-col gap-1">
          <h3
            id="sec-instructions"
            className="text-[length:var(--ct-text-micro)] font-bold text-[var(--ct-text-muted)] uppercase tracking-[0.15em] leading-none"
          >
            Instructions
          </h3>
          <p className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)]">
            Appended verbatim to the system prompt. Never promise returns.
          </p>
        </header>

        <label className="flex flex-col gap-1.5" htmlFor="tpl-systemAdditions">
          <span className={FIELD_LABEL}>Tone &amp; behavior notes</span>
          <textarea
            id="tpl-systemAdditions"
            name="systemAdditions"
            rows={6}
            maxLength={SYSTEM_ADDITIONS_MAX}
            defaultValue={template?.systemAdditions ?? ""}
            onChange={(e) => setSystemLen(e.target.value.length)}
            placeholder="Highlight the Cayman SPV structure and compliance; muted register."
            className={FIELD_CONTROL}
          />
          <span
            aria-live="polite"
            className={cn(
              "text-right text-[length:var(--ct-text-micro)]",
              systemOver ? "text-red-400" : "text-[var(--ct-text-faint)]",
            )}
          >
            {systemLen} / {SYSTEM_ADDITIONS_MAX}
          </span>
        </label>
      </section>

      {/* Live persona preview — the exact register this template encodes. */}
      <div
        className="flex flex-wrap items-center gap-2"
        aria-label="Persona summary"
      >
        <span className={FIELD_LABEL}>Persona</span>
        <Pill accent={entry?.scope === "platform"}>
          {BASE_AGENT_LABELS[baseAgent] ?? baseAgent}
        </Pill>
        {tone && <Pill>{tone}</Pill>}
        {language && <Pill>{language.toUpperCase()}</Pill>}
        {verbosity && <Pill>{verbosity}</Pill>}
      </div>

      <div className="flex items-center">
        <button
          type="submit"
          disabled={isPending || systemOver}
          className={BENTO_PRIMARY_BTN}
        >
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Create template"}
        </button>
      </div>
    </form>
  );
}
