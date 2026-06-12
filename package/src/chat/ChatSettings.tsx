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
        <div className="ct-chat-settings-label">Infra LLM</div>
        <div className="ct-chat-settings-readonly">
          GPT-4.1 · serveur
        </div>
        <div className="ct-chat-settings-hint">
          Clé et modèle configurés côté serveur (
          <span className="mono">OPENAI_API_KEY</span> /{" "}
          <span className="mono">OPENAI_MODEL</span>). Aucune clé client requise.
        </div>
      </section>

      <section className="ct-chat-settings-section">
        <div className="ct-chat-settings-label">Affichage</div>
        <label className="ct-chat-settings-toggle">
          <input
            type="checkbox"
            checked={markdown}
            onChange={(e) => setChatMarkdownEnabled(e.target.checked)}
          />
          <span>Rendu Markdown</span>
        </label>
        {!markdown ? (
          <div className="ct-chat-settings-hint">
            Les réponses s&apos;affichent en texte brut.
          </div>
        ) : null}
      </section>

      <section className="ct-chat-settings-section">
        <div className="ct-chat-settings-label">Contexte produit</div>
        <div className="ct-chat-settings-product">
          <span className="ct-chat-ctx-dot ct-chat-ctx-dot--accent" />
          <span className="ct-chat-settings-product-name">{productName ?? "—"}</span>
        </div>
        <div className="ct-chat-settings-hint">
          L&apos;assistant connaît ce produit automatiquement et adapte ses réponses.
        </div>
      </section>

    </div>
  );
}
