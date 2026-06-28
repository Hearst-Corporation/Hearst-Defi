"use client";

/**
 * ChatKimi.tsx — Couche de rendu pure du chat Hearst Assistant.
 *
 * Toute la logique d'état et de streaming est dans useChat.ts.
 * Ce composant gère : JSX, textarea, focus, scroll, retry, reset.
 *
 * Skin : bento Tailwind (canon Portfolio) — panneaux `bg-black` / sous-surfaces
 * `bg-[#15191C]`, bordures `border-white/10`, accent unique #A7FB90. Deux classes
 * legacy sont CONSERVÉES car ce sont des points d'ancrage structurels :
 *   - `ct-chat-root` : la coquille (RailRight) cible `.ct-rail-right-body:has(.ct-chat-root)`
 *     pour passer le body en `overflow:hidden; min-height:0` (le scroll vit alors
 *     sur la liste interne — cf. cockpit.css "Chat scroll fix").
 *   - `ct-chat-list` : porte le fix `min-height:0` du viewport scrollable + l'ancrage
 *     bas (`> :first-child { margin-top:auto }`) et les masques de fondu.
 * Les retirer casserait le scroll. Tout le reste du markup est en Tailwind.
 */

import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import DOMPurify from "dompurify";
import { cn } from "@/lib/cn";
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
} from "../stores/activeProductStore";
import {
  subscribe as subActiveChat,
  getSnapshot as getActiveChat,
  getServerSnapshot as getActiveChatSSR,
  setActiveChat,
} from "../stores/activeChatStore";
import { setChatStreaming } from "../stores/chatStreamingStore";
import { useCockpit } from "../shell/context";
import { HearstMark } from "../shell/HearstMark";
import type { ChatChart, ChatMessage } from "./types";
import { isChatMarkdownEnabled, subscribeChatMarkdown } from "./prefs";
import { useChat } from "./useChat";
// Client-side fast navigation. The pure resolvers run locally (LP scope) so a
// nav gesture navigates with ZERO network round-trip; only real questions POST.
// Single seam into the app-side resolvers (see src/lib/llm/client-nav.ts).
import { resolveClientNav } from "@/lib/llm/client-nav";
// Empty-state quick-action chips (agent-canvas presets). App-side component,
// imported across the alias boundary like client-nav above.
import { ChatPresets } from "@/components/chat/chat-presets";

// ---------------------------------------------------------------------------
// Markdown léger — pas de lib lourde
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarkdown(text: string): string {
  // Replace code blocks first to protect their content from other replacements
  let html = text
      .replace(
        /```(\w*)\n?([\s\S]*?)```/g,
        (_m, _lang: string, code: string) =>
          `<pre><code>${escapeHtml(code.trimEnd())}</code></pre>`,
      )
      .replace(
        /`([^`]+)`/g,
        (_m, c: string) => `<code>${escapeHtml(c)}</code>`,
      );

  // Headings
  html = html
      .replace(/^### (.*?)$/gm, "<h3>$1</h3>")
      .replace(/^## (.*?)$/gm, "<h2>$1</h2>")
      .replace(/^# (.*?)$/gm, "<h1>$1</h1>");

  // Bold and Italic
  html = html
      .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Lists
  html = html.replace(/((?:^[-*] .+$\n?)+)/gm, (block) => {
    const items = block
      .split("\n")
      .filter(Boolean)
      .map((line) => `<li>${line.replace(/^[-*] /, "")}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  });

  // Clean up trailing newlines after block elements to prevent excessive <br>
  html = html.replace(/(<\/(?:h1|h2|h3|ul|pre)>)\n/g, "$1");
  // Replace remaining newlines with <br> but NOT inside <pre> blocks
  // (though our simple regex above already handled pre blocks)
  return html.replace(/\n/g, "<br>");
}

function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return "";
  return DOMPurify.sanitize(html);
}

// ---------------------------------------------------------------------------
// Tokens de style partagés (bento) — réutilisés par plusieurs sous-composants.
// ---------------------------------------------------------------------------

/** Label micro : nano, uppercase, tracking large, gras, muted. */
const MICRO_LABEL = "ct-bento-label";

// Markdown body — Tailwind via arbitrary descendant variants. Reproduit la prose
// chat : titres serrés, listes à puces accent, code mono teinté accent, blocs pre
// encadrés. Pas de halo, juste typographie + espacement.
const MARKDOWN_PROSE = cn(
  "text-[length:var(--ct-text-xs)] leading-[1.65] text-zinc-300",
  // Headings
  "[&_h1]:mt-5 [&_h1]:mb-2 [&_h1]:text-[18px] [&_h1]:font-bold [&_h1]:leading-tight [&_h1]:text-white",
  "[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-[length:var(--ct-text-sm)] [&_h2]:font-semibold [&_h2]:leading-tight [&_h2]:text-white",
  "[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-[length:var(--ct-text-xs)] [&_h3]:font-semibold [&_h3]:leading-tight [&_h3]:text-white",
  "[&_h1:first-child]:mt-0 [&_h2:first-child]:mt-0 [&_h3:first-child]:mt-0",
  // Paragraphs
  "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
  // Inline emphasis
  "[&_strong]:font-bold [&_strong]:text-white [&_em]:italic [&_em]:opacity-90",
  // Lists
  "[&_ul]:my-2 [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:pl-5 [&_li]:my-1",
  "[&_li]:marker:text-[var(--ct-accent)]",
  // Code
  "[&_code]:rounded [&_code]:bg-black/40 [&_code]:px-[5px] [&_code]:py-[2px] [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-[var(--ct-accent)]",
  "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-white/10 [&_pre]:bg-black/60 [&_pre]:p-3 [&_pre]:text-[length:var(--ct-text-2xs)] [&_pre]:font-mono",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-zinc-300",
);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChatKimiProps {
  /** Nom du produit en cours, pour le placeholder/contexte. */
  productName?: string;
  /** Accent du produit, pour la pastille + bouton envoyer. */
  productColor?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatKimi({ productName, productColor }: ChatKimiProps = {}) {
  const [input, setInput] = useState<string>("");

  const chatListRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeProduct = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const activeChat = useSyncExternalStore(
    subActiveChat,
    getActiveChat,
    getActiveChatSSR,
  );
  const { chatConfig } = useCockpit();

  const { messages, streaming, error, sendMessage, appendLocal, reset, queued } =
    useChat({
      apiEndpoint: chatConfig.apiEndpoint ?? "/api/cockpit-chat",
      persistence: chatConfig.persistence,
      productId: activeProduct,
      chatId: activeChat,
      onChatId: (id) => setActiveChat(id),
    });

  // The chat is "empty" when there is no real exchange yet — i.e. zero messages
  // OR only the seeded `welcome` greeting from useChat. We treat the lone welcome
  // as empty so the empty-state (context card + ChatPresets quick-action chips)
  // renders instead; otherwise the welcome message would permanently satisfy
  // `messages.length > 0` and the preset chips would never appear.
  const isConversationEmpty =
    messages.length === 0 ||
    (messages.length === 1 && messages[0]?.id === "welcome");

  // Keep scrolling local to the chat list. `scrollIntoView()` can bubble up to a
  // larger ancestor and visually yank the whole center panel when a message lands.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on messages update
  useEffect(() => {
    const list = chatListRef.current;
    if (!list) return;
    list.scrollTo({
      top: list.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Publie l'état streaming dans le store partagé pour que le header du rail
  // droit (RailRight, hors de ce hook) puisse pulser sa pastille en mode "live".
  // On le remet à false au démontage pour ne jamais laisser le dot bloqué.
  useEffect(() => {
    setChatStreaming(streaming);
  }, [streaming]);
  useEffect(() => {
    return () => setChatStreaming(false);
  }, []);

  // Auto-grow : grandit le textarea avec son contenu jusqu'à un plafond, puis
  // scroll interne. Piloté uniquement par la frappe (onChange) et les resets —
  // PAS par un useEffect sur `input`, qui se redéclenchait à chaque vidage
  // interne et provoquait un reflow synchrone faisant "sauter" tout le panneau
  // au premier message. `height:auto` d'abord pour pouvoir REdescendre.
  const autoGrow = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, []);
  // Réinitialise la hauteur (3 lignes par défaut via rows={3}) après un reset.
  const resetGrow = useCallback(() => {
    const el = textareaRef.current;
    if (el) el.style.height = "";
  }, []);

  // Canvas → chat hand-back. A canvas option (effect "prefill_chat") dispatches
  // `cockpit:chat-prefill`; we pre-fill the input (editable, never auto-sent),
  // mirroring the preset-chip behaviour. Same window-event seam as nav-local.
  useEffect(() => {
    const onPrefill = (event: Event): void => {
      const detail = (event as CustomEvent).detail as { prompt?: unknown } | undefined;
      const prompt = typeof detail?.prompt === "string" ? detail.prompt : null;
      if (!prompt) return;
      setInput(prompt);
      requestAnimationFrame(() => {
        autoGrow();
        textareaRef.current?.focus();
      });
    };
    window.addEventListener("cockpit:chat-prefill", onPrefill);
    return () => window.removeEventListener("cockpit:chat-prefill", onPrefill);
  }, [autoGrow]);

  const newConversation = useCallback(() => {
    setActiveChat(null);
    reset();
    setInput("");
    resetGrow();
  }, [reset, resetGrow]);

  const handleSend = useCallback(
    (text: string) => {
      // NB: on N'interdit PLUS l'envoi pendant le streaming. sendMessage gère
      // lui-même la règle à 2 niveaux (file d'attente sur submit isolé, FORCE
      // sur double-submit rapide). Le textarea reste actif en permanence.
      if (!text.trim()) return;
      setInput("");
      resetGrow();

      // CLIENT FAST-PATH (zero network). Resolve the message against the SAME
      // pure regex resolvers the server runs before any LLM call, at LP scope
      // (the client cannot know the admin role — admin nav falls through to the
      // server, which can). Three outcomes:
      //   nav    → navigate locally + echo the ack bubble, NO POST.
      //   reject → echo the reject bubble (nav gesture, no destination), NO POST.
      //   chat   → a real question (or admin nav) → POST exactly as today.
      // The server early-exit stays intact as defense-in-depth for clients that
      // don't run this JS and for admin navigation.
      const client = resolveClientNav(text);

      if (client.kind === "nav" && client.route && client.ack) {
        appendLocal(text, client.ack);
        if (typeof window !== "undefined") {
          // The nav bridge translates this into the SAME pending/auto-nav
          // machinery as a server-published directive, so protected-route
          // confirmation still applies — no blind router.push.
          window.dispatchEvent(
            new CustomEvent("cockpit:nav-local", {
              detail: { route: client.route, label: client.label },
            }),
          );
        }
        requestAnimationFrame(() => textareaRef.current?.focus());
        return;
      }

      if (client.kind === "reject" && client.ack) {
        appendLocal(text, client.ack);
        requestAnimationFrame(() => textareaRef.current?.focus());
        return;
      }

      // Real question → server, exactly as before.
      sendMessage(text);
      // Signal the chat-nav-bridge to re-arm its poll cadence immediately so that
      // any navigation directive the Master Agent publishes for this turn is picked
      // up at POLL_MS latency, not at the current backed-off delay (up to 7.2 s).
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cockpit:chat-sent"));
      }
      // Re-focus après envoi.
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [sendMessage, appendLocal, resetGrow],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend(input);
      }
    },
    [input, handleSend],
  );

  const retryLast = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    sendMessage(lastUser.content);
  }, [messages, sendMessage]);

  const accent = productColor ?? "#A7FB90";

  return (
    // `ct-chat-root` conservé : hook structurel du shell (`:has()`) + colonne flex.
    <div className="ct-chat-root flex h-full min-h-0 flex-1 flex-col">
      {/* Action bar */}
      <div className="flex items-center gap-2 pb-1">
        <button
          type="button"
          onClick={newConversation}
          title="New chat"
          aria-label="Start new conversation"
          className="ml-auto rounded-lg border border-white/10 bg-white/5 px-2 py-[3px] text-[length:var(--ct-text-micro)] font-semibold text-zinc-300 transition-colors duration-150 hover:border-[color-mix(in_srgb,var(--ct-accent)_40%,transparent)] hover:text-white"
        >
          + New
        </button>
      </div>

      {/* Messages — `ct-chat-list` conservé : porte le fix scroll (min-h-0),
          l'ancrage bas (> :first-child margin-top:auto) et les masques de fondu. */}
      <div
        ref={chatListRef}
        className="ct-chat-list flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-12"
      >
        {isConversationEmpty && !streaming && (
          <div className="m-auto flex w-full flex-col gap-4">
            {/* Assistant panel — hero premium, un seul panneau bento */}
            <div className="rounded-2xl border border-white/10 bg-black p-6 shadow-sm">
              <div className="flex flex-col items-center gap-3 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--ct-accent)_20%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[var(--ct-accent)]">
                  <HearstMark size={26} />
                </span>
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-[17px] font-semibold tracking-tight text-white">Hearst Assistant</h2>
                  <p className="mx-auto max-w-[240px] text-[length:var(--ct-text-xs)] leading-relaxed text-zinc-500">
                    Your institutional co-pilot for portfolio insights and vault analysis.
                  </p>
                </div>
              </div>
            </div>

            {/* Suggested actions panel — bento noir */}
            <div className="flex flex-col gap-3.5 rounded-2xl border border-white/10 bg-black p-5 shadow-sm">
              <div className={cn("self-start", MICRO_LABEL)}>Suggested Actions</div>
              <ChatPresets
                masterAgentEnabled={chatConfig.masterAgentEnabled ?? true}
                onPick={(text) => {
                  setInput(text);
                  requestAnimationFrame(() => {
                    autoGrow();
                    textareaRef.current?.focus();
                  });
                }}
              />
            </div>
          </div>
        )}

        {!isConversationEmpty && messages.map((msg) => {
          // The seeded greeting (id "welcome") lives ONLY in the empty-state card
          // above; never render it as a bubble. Otherwise, the instant the first
          // message is sent, the big welcome card is replaced by a redundant tiny
          // welcome bubble flashing in — the "brutal" disappearance. Skipping it
          // makes the empty-state replaced cleanly by the real conversation.
          if (msg.id === "welcome") return null;
          // Cache la bulle assistant vide en attente de stream — on affiche
          // uniquement le logo H (indicateur de réflexion) à la place.
          if (
            msg.role === "assistant" &&
            msg.content === "" &&
            (msg.charts?.length ?? 0) === 0
          ) return null;
          return (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isStreamingThis={
                streaming &&
                msg.role === "assistant" &&
                msg === messages[messages.length - 1]
              }
            />
          );
        })}

        {/* Indicateur de réflexion : logo H sous la dernière bulle assistant pendant le streaming */}
        {streaming && (
          <div
            className="flex animate-pulse items-center justify-start py-3 text-[var(--ct-accent)]"
            aria-label="The assistant is thinking"
          >
            <HearstMark size={18} />
          </div>
        )}

        {error && (
          <div className="my-4 flex flex-col gap-2.5 rounded-2xl border border-[#f9a03f]/20 bg-[#f9a03f]/[0.06] px-4 py-3">
            <p className="text-[length:var(--ct-text-xs)] font-medium leading-normal text-white">{error}</p>
            <button
              type="button"
              onClick={retryLast}
              className="inline-flex items-center gap-1.5 self-start rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[length:var(--ct-text-2xs)] font-semibold text-zinc-300 transition-colors duration-150 hover:border-[color-mix(in_srgb,var(--ct-accent)_40%,transparent)] hover:text-[var(--ct-accent)]"
              aria-label="Retry last message"
            >
              ↻ Retry
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* File d'attente : un prompt mis en file (1× Entrée pendant une réponse)
          part automatiquement à la fin du tour courant. État honnête — il n'est
          PAS encore envoyé. Double-Entrée rapide force l'envoi immédiat. */}
      {queued ? (
        <div
          className="mt-2 flex min-w-0 items-center gap-1.5 rounded-lg border border-white/10 bg-[#15191C]/50 px-2.5 py-1.5 text-[length:var(--ct-text-xs)] text-zinc-400"
          aria-live="polite"
        >
          <span
            className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--ct-accent)]"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate text-white">Queued · {queued}</span>
          <span className="shrink-0 text-zinc-500">sends after this reply — press Enter again to force</span>
        </div>
      ) : null}

      {/* Input */}
      <div className="mt-auto flex flex-col gap-2.5 pt-2">
        <div className="flex items-center justify-center gap-1.5 text-[length:var(--ct-text-micro)] italic text-zinc-500">
          <svg className="h-3 w-3 shrink-0 not-italic text-zinc-600" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <rect x="2.5" y="5.5" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
            <path d="M4.5 5.5V4a2 2 0 0 1 4 0v1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
          Drafts are prepared in review mode. Nothing sends without confirmation.
        </div>
        <form
          className="flex items-end gap-2 rounded-xl border border-white/10 bg-[#15191C] py-2 pl-3.5 pr-2 shadow-sm transition-colors duration-150 focus-within:border-[color-mix(in_srgb,var(--ct-accent)_40%,transparent)]"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
        >
          <textarea
            ref={textareaRef}
            className="max-h-[10.5rem] min-h-10 flex-1 resize-none border-none bg-transparent py-1.5 text-[length:var(--ct-text-xs)] leading-normal text-white outline-none placeholder:text-zinc-500"
            rows={1}
            placeholder="Message the assistant…"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autoGrow();
            }}
            onKeyDown={handleKeyDown}
          />
          <button
            type="submit"
            className={cn(
              "flex aspect-square h-9 w-9 shrink-0 items-center justify-center rounded-full p-0 transition-colors duration-150",
              input.trim()
                ? "text-black"
                : "border border-white/10 bg-transparent text-zinc-500",
            )}
            disabled={!input.trim()}
            aria-label={streaming ? "Queue or send message" : "Send message"}
            style={input.trim() ? { background: accent } : undefined}
          >
            {streaming ? (
              <span className="inline-flex items-center gap-[3px]">
                <span className="h-1 w-1 animate-pulse rounded-full bg-current" />
                <span className="h-1 w-1 animate-pulse rounded-full bg-current [animation-delay:0.15s]" />
                <span className="h-1 w-1 animate-pulse rounded-full bg-current [animation-delay:0.3s]" />
              </span>
            ) : (
              <svg
                className="h-[18px] w-[18px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  msg: ChatMessage;
  isStreamingThis: boolean;
}

function MessageBubble({ msg, isStreamingThis }: MessageBubbleProps) {
  const markdown = useSyncExternalStore(
    subscribeChatMarkdown,
    isChatMarkdownEnabled,
    () => true,
  );
  const isUser = msg.role === "user";
  const isEmpty = msg.content === "" && (msg.charts?.length ?? 0) === 0;

  return (
    <div
      className={cn(
        "flex flex-col py-2 text-[length:var(--ct-text-xs)] leading-relaxed",
        isUser ? "max-w-[85%] items-end self-end text-right" : "max-w-full items-start self-start",
      )}
    >
      {!isEmpty ? (
        <span
          className={cn(
            "mb-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase leading-none tracking-[0.12em]",
            isUser
              ? "self-end text-zinc-500"
              : "text-[var(--ct-accent)] before:h-1.5 before:w-1.5 before:rounded-full before:bg-[var(--ct-accent)] before:content-['']",
          )}
        >
          {isUser ? "You" : "Assistant"}
        </span>
      ) : null}
      {isEmpty ? (
        <div className="inline-flex items-center gap-[3px]">
          <span className="h-1 w-1 animate-pulse rounded-full bg-[var(--ct-accent)]" />
          <span className="h-1 w-1 animate-pulse rounded-full bg-[var(--ct-accent)] [animation-delay:0.15s]" />
          <span className="h-1 w-1 animate-pulse rounded-full bg-[var(--ct-accent)] [animation-delay:0.3s]" />
        </div>
      ) : isUser ? (
        <p className="m-0 whitespace-pre-wrap italic text-white/90">{msg.content}</p>
      ) : markdown ? (
        <>
          {msg.content ? (
            <div
              className={MARKDOWN_PROSE}
              // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized via DOMPurify
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(renderMarkdown(msg.content)),
              }}
            />
          ) : null}
          <ChatCharts charts={msg.charts} />
          {isStreamingThis && <StreamCursor />}
        </>
      ) : (
        <>
          {msg.content ? (
            <p className="m-0 whitespace-pre-wrap text-zinc-300">{msg.content}</p>
          ) : null}
          <ChatCharts charts={msg.charts} />
          {isStreamingThis && <StreamCursor />}
        </>
      )}
    </div>
  );
}

/** Curseur de streaming — barre accent qui pulse en fin de texte. */
function StreamCursor() {
  return (
    <span className="ml-0.5 inline-block h-[1.1em] w-0.5 animate-pulse bg-[var(--ct-accent)] align-text-bottom shadow-[0_0_8px_var(--ct-accent)]" />
  );
}

function ChatCharts({ charts }: { charts: ChatChart[] | undefined }) {
  if (!charts || charts.length === 0) return null;
  return (
    <div className="mt-2.5 grid gap-2.5 whitespace-normal" aria-label="Charts generated by the chat">
      {charts.map((chart) => (
        <ChatChartCard key={chart.id} chart={chart} />
      ))}
    </div>
  );
}

function ChatChartCard({ chart }: { chart: ChatChart }) {
  return (
    <article
      className={cn(
        "mt-2 rounded-lg border border-white/10 bg-[#15191C]/40 p-3 transition-colors duration-150 hover:border-white/20",
        chart.status === "building" && "opacity-80",
      )}
    >
      <div className="mb-2 flex items-start justify-between">
        <div>
          <div className={MICRO_LABEL}>{chart.title}</div>
          <div className="text-[length:var(--ct-text-xs)] font-semibold text-white">{chart.metric}</div>
        </div>
        <span className="rounded bg-white/5 px-1 py-px text-[9px] uppercase text-zinc-500">{chart.provenance}</span>
      </div>
      <ChartVisual chart={chart} />
      <div className="flex justify-between text-[length:var(--ct-text-micro)] text-zinc-500">
        <span>{chart.status === "ready" ? "Ready" : "Building"}</span>
        <span>{Math.round(chart.progress)}%</span>
      </div>
      <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        <span
          className="block h-full rounded-[inherit] bg-[var(--ct-accent)] transition-[width] duration-150"
          style={{ width: `${Math.max(4, Math.min(100, chart.progress))}%` }}
        />
      </div>
      <p className="mt-2 text-[length:var(--ct-text-micro)] leading-snug text-zinc-500">{chart.note}</p>
    </article>
  );
}

function ChartVisual({ chart }: { chart: ChatChart }) {
  if (chart.kind === "allocation_stack") {
    return <AllocationStack chart={chart} />;
  }
  if (chart.kind === "distribution_range") {
    return <DistributionRange chart={chart} />;
  }
  return <StressCorridor chart={chart} />;
}

/** Skeleton de chargement d'un chart — barre balayée par un gradient accent. */
function ChartSkeleton() {
  return (
    <div className="mt-1.5 h-[76px] animate-pulse rounded-lg bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--ct-accent)_15%,transparent)] to-transparent bg-white/5" />
  );
}

function AllocationStack({ chart }: { chart: ChatChart }) {
  if (!chart.segments || chart.segments.length === 0) {
    return <ChartSkeleton />;
  }
  let x = 0;
  return (
    <svg className="mt-1.5 block h-[76px] w-full" viewBox="0 0 260 74" role="img" aria-label={chart.title}>
      <rect x="0" y="20" width="260" height="18" rx="9" className="fill-white/10" />
      {chart.segments.map((segment) => {
        const width = (segment.value / 100) * 260;
        const currentX = x;
        x += width;
        return (
          <g key={segment.label}>
            <rect
              x={currentX}
              y="20"
              width={width}
              height="18"
              rx="9"
              fill={segment.color}
              opacity="0.9"
            />
            <text x={currentX + 4} y="56" className="fill-zinc-500 text-[8px]">
              {segment.value}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DistributionRange({ chart }: { chart: ChatChart }) {
  if (!chart.points || chart.points.length === 0) {
    return <ChartSkeleton />;
  }
  const lows = chart.points
    .map((point, index) => `${18 + index * 44},${56 - (point.low ?? 0) * 1.3}`)
    .join(" ");
  const highs = chart.points
    .map((point, index) => `${18 + index * 44},${56 - (point.high ?? 0) * 1.3}`)
    .join(" ");
  return (
    <svg className="mt-1.5 block h-[76px] w-full" viewBox="0 0 260 74" role="img" aria-label={chart.title}>
      <polyline points={highs} fill="none" className="stroke-[var(--ct-accent)] [stroke-width:2.2]" />
      <polyline points={lows} fill="none" className="stroke-[#60a5fa] [stroke-width:2.2]" />
      <line x1="18" y1="58" x2="238" y2="58" className="stroke-white/10 [stroke-width:1]" />
      <text x="18" y="70" className="fill-zinc-500 text-[8px]">M1</text>
      <text x="222" y="70" className="fill-zinc-500 text-[8px]">M12</text>
    </svg>
  );
}

function StressCorridor({ chart }: { chart: ChatChart }) {
  if (!chart.points || chart.points.length === 0) {
    return <ChartSkeleton />;
  }
  const points = chart.points
    .map((point, index) => `${20 + index * 70},${70 - (point.value ?? 0) * 0.7}`)
    .join(" ");
  return (
    <svg className="mt-1.5 block h-[76px] w-full" viewBox="0 0 260 74" role="img" aria-label={chart.title}>
      <polyline points={points} fill="none" className="stroke-[#f9a03f] [stroke-width:2.4]" />
      <line x1="20" y1="58" x2="232" y2="58" className="stroke-white/10 [stroke-width:1]" />
      {chart.points.map((point, index) => (
        <circle
          key={point.label}
          cx={20 + index * 70}
          cy={70 - (point.value ?? 0) * 0.7}
          r="3.5"
          className="fill-[var(--ct-accent)]"
        />
      ))}
    </svg>
  );
}
