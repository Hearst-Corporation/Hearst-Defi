"use client";

/**
 * ChatKimi.tsx — Couche de rendu pure du chat Kimi 2.6.
 *
 * Toute la logique d'état et de streaming est dans useChat.ts.
 * Ce composant gère : JSX, textarea, focus, scroll, retry, reset.
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

  const accent = productColor ?? "var(--ct-accent, #A7FB90)";

  return (
    <div className="ct-chat-root">
      {/* Action bar */}
      <div className="ct-chat-actionbar">
        <button
          type="button"
          onClick={newConversation}
          title="New chat"
          aria-label="Start new conversation"
          className="ct-chat-newbtn"
        >
          + New
        </button>
      </div>

      {/* Messages */}
      <div ref={chatListRef} className="ct-chat-list">
        {messages.length === 0 && !streaming && (
          <div className="ct-chat-empty">
            <div className="ct-chat-welcome">
              <div className="ct-chat-welcome-icon">
                <HearstMark size={24} />
              </div>
              <h2 className="ct-chat-welcome-title">Hearst Assistant</h2>
              <p className="ct-chat-welcome-text">
                Your institutional co-pilot for portfolio insights and vault analysis.
              </p>
            </div>

            <div className="ct-chat-context-card">
              <div className="ct-chat-context-card-header">
                <svg className="ct-chat-icon" viewBox="0 0 13 13" fill="none">
                  <path d="M6.5 1.5V11.5M1.5 6.5H11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <span>Current Context</span>
              </div>
              <div className="ct-chat-context-card-body">
                {productName ? (
                  <div className="ct-chat-context-item">
                    <span className="ct-chat-context-dot" style={{ background: productColor }} />
                    <span>{productName}</span>
                  </div>
                ) : (
                  <div className="ct-chat-context-item">
                    <span className="ct-chat-context-dot" />
                    <span>General Portfolio</span>
                  </div>
                )}
                <div className="ct-chat-context-item">
                  <span className="ct-chat-context-dot" />
                  <span>Verified Data Feeds</span>
                </div>
              </div>
            </div>

            <div className="ct-chat-suggestions-label">Suggested Actions</div>
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
        )}

        {messages.map((msg) => {
          // Cache la bulle assistant vide en attente de stream — on affiche
          // uniquement le logo H (ct-chat-thinking) à la place.
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
            className="ct-chat-thinking active"
            aria-label="The assistant is thinking"
          >
            <HearstMark size={18} />
          </div>
        )}

        {error && (
          <div className="ct-chat-error">
            <p>{error}</p>
            <button
              type="button"
              onClick={retryLast}
              className="ct-chat-retry"
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
        <div className="ct-chat-queued" aria-live="polite">
          <span className="ct-chat-queued-dot" aria-hidden="true" />
          <span className="ct-chat-queued-text">Queued · {queued}</span>
          <span className="ct-chat-queued-hint">sends after this reply — press Enter again to force</span>
        </div>
      ) : null}

      {/* Input */}
      <div className="ct-chat-composer-wrap">
        <div className="ct-chat-composer-hint">
          I can guide and analyze, not transact.
        </div>
        <form
          className="ct-chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
        >
          <textarea
            ref={textareaRef}
            className="ct-chat-input"
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
            className="ct-chat-send"
            disabled={!input.trim()}
            aria-label={streaming ? "Queue or send message" : "Send message"}
            style={input.trim() ? { background: accent } : undefined}
          >
            {streaming ? (
              <span className="ct-chat-send-dots">
                <span /><span /><span />
              </span>
            ) : (
              <svg
                className="ct-chat-icon"
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
    <div className={`ct-chat-msg ${isUser ? "user" : "assistant"}`}>
      {!isEmpty ? (
        <span
          className={`ct-chat-badge ${isUser ? "ct-chat-badge--user" : "ct-chat-badge--agent"}`}
        >
          {isUser ? "You" : "Assistant"}
        </span>
      ) : null}
      {isEmpty ? (
        <div className="ct-chat-typing">
          <span />
          <span />
          <span />
        </div>
      ) : isUser ? (
        <p className="ct-chat-msg-plain">{msg.content}</p>
      ) : markdown ? (
        <>
          {msg.content ? (
            <div
              className="ct-chat-msg-md"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized via DOMPurify
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(renderMarkdown(msg.content)),
              }}
            />
          ) : null}
          <ChatCharts charts={msg.charts} />
          {isStreamingThis && (
            <span className="ct-chat-cursor ct-chat-cursor--accent" />
          )}
        </>
      ) : (
        <>
          {msg.content ? <p className="ct-chat-msg-plain">{msg.content}</p> : null}
          <ChatCharts charts={msg.charts} />
          {isStreamingThis && (
            <span className="ct-chat-cursor ct-chat-cursor--accent" />
          )}
        </>
      )}
    </div>
  );
}

function ChatCharts({ charts }: { charts: ChatChart[] | undefined }) {
  if (!charts || charts.length === 0) return null;
  return (
    <div className="ct-chat-charts" aria-label="Charts generated by the chat">
      {charts.map((chart) => (
        <ChatChartCard key={chart.id} chart={chart} />
      ))}
    </div>
  );
}

function ChatChartCard({ chart }: { chart: ChatChart }) {
  return (
    <article className={`ct-chat-chart ct-chat-chart--${chart.status}`}>
      <div className="ct-chat-chart-head">
        <div>
          <div className="ct-chat-chart-title">{chart.title}</div>
          <div className="ct-chat-chart-metric">{chart.metric}</div>
        </div>
        <span className="ct-chat-chart-badge">{chart.provenance}</span>
      </div>
      <ChartVisual chart={chart} />
      <div className="ct-chat-chart-foot">
        <span>{chart.status === "ready" ? "Ready" : "Building"}</span>
        <span>{Math.round(chart.progress)}%</span>
      </div>
      <div className="ct-chat-chart-progress" aria-hidden="true">
        <span style={{ width: `${Math.max(4, Math.min(100, chart.progress))}%` }} />
      </div>
      <p className="ct-chat-chart-note">{chart.note}</p>
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

function AllocationStack({ chart }: { chart: ChatChart }) {
  if (!chart.segments || chart.segments.length === 0) {
    return <div className="ct-chat-chart-skeleton" />;
  }
  let x = 0;
  return (
    <svg className="ct-chat-chart-svg" viewBox="0 0 260 74" role="img" aria-label={chart.title}>
      <rect x="0" y="20" width="260" height="18" rx="9" className="ct-chat-chart-base" />
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
            <text x={currentX + 4} y="56" className="ct-chat-chart-text">
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
    return <div className="ct-chat-chart-skeleton" />;
  }
  const lows = chart.points
    .map((point, index) => `${18 + index * 44},${56 - (point.low ?? 0) * 1.3}`)
    .join(" ");
  const highs = chart.points
    .map((point, index) => `${18 + index * 44},${56 - (point.high ?? 0) * 1.3}`)
    .join(" ");
  return (
    <svg className="ct-chat-chart-svg" viewBox="0 0 260 74" role="img" aria-label={chart.title}>
      <polyline points={highs} fill="none" className="ct-chat-chart-line-accent" />
      <polyline points={lows} fill="none" className="ct-chat-chart-line-info" />
      <line x1="18" y1="58" x2="238" y2="58" className="ct-chat-chart-axis" />
      <text x="18" y="70" className="ct-chat-chart-text">M1</text>
      <text x="222" y="70" className="ct-chat-chart-text">M12</text>
    </svg>
  );
}

function StressCorridor({ chart }: { chart: ChatChart }) {
  if (!chart.points || chart.points.length === 0) {
    return <div className="ct-chat-chart-skeleton" />;
  }
  const points = chart.points
    .map((point, index) => `${20 + index * 70},${70 - (point.value ?? 0) * 0.7}`)
    .join(" ");
  return (
    <svg className="ct-chat-chart-svg" viewBox="0 0 260 74" role="img" aria-label={chart.title}>
      <polyline points={points} fill="none" className="ct-chat-chart-line-warning" />
      <line x1="20" y1="58" x2="232" y2="58" className="ct-chat-chart-axis" />
      {chart.points.map((point, index) => (
        <circle
          key={point.label}
          cx={20 + index * 70}
          cy={70 - (point.value ?? 0) * 0.7}
          r="3.5"
          className="ct-chat-chart-dot"
        />
      ))}
    </svg>
  );
}

