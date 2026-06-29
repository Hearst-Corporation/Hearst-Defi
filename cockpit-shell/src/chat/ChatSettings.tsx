"use client";

/**
 * ChatSettings — panneau réglages du chat (vue settings du RailRight).
 * Affichage client uniquement ; clé/modèle LLM = serveur (OPENAI_API_KEY / OPENAI_MODEL).
 */

import { useEffect, useSyncExternalStore } from "react";

import {
  isChatMarkdownEnabled,
  purgeLegacyChatPrefs,
  setChatMarkdownEnabled,
  subscribeChatMarkdown,
} from "./prefs";

export interface ChatSettingsProps {
  productName?: string;
}

const MICRO_LABEL = "ct-bento-label";

export function ChatSettings({ productName }: ChatSettingsProps = {}) {
  const markdown = useSyncExternalStore(
    subscribeChatMarkdown,
    isChatMarkdownEnabled,
    () => true,
  );
  useEffect(() => {
    purgeLegacyChatPrefs();
  }, []);

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-[var(--ct-surface-card)] p-3">
      <section className="rounded-lg border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] p-4">
        <div className={MICRO_LABEL}>LLM infra</div>
        <div className="mt-2 text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-text-body)]">
          OpenAI · server
        </div>
        <p className="mt-2 text-[length:var(--ct-text-2xs)] leading-relaxed text-[var(--ct-text-faint)]">
          Key and model are configured server-side (
          <span className="font-mono text-[var(--ct-text-muted)]">OPENAI_API_KEY</span> /{" "}
          <span className="font-mono text-[var(--ct-text-muted)]">OPENAI_MODEL</span>). No
          client key required.
        </p>
      </section>

      <section className="rounded-lg border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] p-4">
        <div className={MICRO_LABEL}>Display</div>
        <label className="mt-2 flex cursor-pointer items-center justify-between py-3 border-b border-[var(--ct-border-soft)]">
          <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-body)]">Markdown rendering</span>
          <span className="relative inline-flex">
            <input
              type="checkbox"
              checked={markdown}
              onChange={(e) => setChatMarkdownEnabled(e.target.checked)}
              className="peer sr-only"
            />
            <span className="h-5 w-9 rounded-full border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] transition-colors duration-150 peer-checked:border-[var(--ct-accent)] peer-checked:bg-[var(--ct-accent)]" />
            <span className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-[var(--ct-text-muted)] transition-transform duration-150 peer-checked:translate-x-4 peer-checked:bg-[var(--ct-bg-deep)]" />
          </span>
        </label>
        {!markdown ? (
          <p className="mt-2 text-[length:var(--ct-text-2xs)] leading-relaxed text-[var(--ct-text-faint)]">
            Responses render as plain text.
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] p-4">
        <div className={MICRO_LABEL}>Product context</div>
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--ct-border-soft)] bg-[var(--ct-surface-card)] px-3 py-2.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--ct-accent)] shadow-[0_0_8px_var(--ct-accent)]" />
          <span className="truncate text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-text-body)]">
            {productName ?? "—"}
          </span>
        </div>
        <p className="mt-2 text-[length:var(--ct-text-2xs)] leading-relaxed text-[var(--ct-text-faint)]">
          The assistant knows this product automatically and tailors its
          answers.
        </p>
      </section>
    </div>
  );
}
