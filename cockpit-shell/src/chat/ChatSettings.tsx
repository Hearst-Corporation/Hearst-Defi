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
    <div className="ct-chat-settings">
      <section className="ct-chat-settings-section">
        <div className="ct-chat-settings-label">LLM infra</div>
        <div className="ct-chat-settings-readonly">
          GPT-4.1 · server
        </div>
        <div className="ct-chat-settings-hint">
          Key and model are configured server-side (
          <span className="mono">OPENAI_API_KEY</span> /{" "}
          <span className="mono">OPENAI_MODEL</span>). No client key required.
        </div>
      </section>

      <section className="ct-chat-settings-section">
        <div className="ct-chat-settings-label">Display</div>
        <label className="ct-chat-settings-toggle">
          <input
            type="checkbox"
            checked={markdown}
            onChange={(e) => setChatMarkdownEnabled(e.target.checked)}
          />
          <span>Markdown rendering</span>
        </label>
        {!markdown ? (
          <div className="ct-chat-settings-hint">
            Responses render as plain text.
          </div>
        ) : null}
      </section>

      <section className="ct-chat-settings-section">
        <div className="ct-chat-settings-label">Product context</div>
        <div className="ct-chat-settings-product">
          <span className="ct-chat-ctx-dot ct-chat-ctx-dot--accent" />
          <span className="ct-chat-settings-product-name">{productName ?? "—"}</span>
        </div>
        <div className="ct-chat-settings-hint">
          The assistant knows this product automatically and tailors its answers.
        </div>
      </section>

    </div>
  );
}
