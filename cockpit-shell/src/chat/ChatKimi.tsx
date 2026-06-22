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
import { useCockpit } from "../shell/context";
import { HearstMark } from "../shell/HearstMark";
import type { ChatChart, ChatMessage } from "./types";
import { isChatMarkdownEnabled, subscribeChatMarkdown } from "./prefs";
import { useChat } from "./useChat";

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
  // Replace newlines except those immediately following a closing block tag to avoid double spacing
  let html = text
      .replace(
        /```(\w*)\n?([\s\S]*?)```/g,
        (_m, _lang: string, code: string) =>
          `<pre><code>${escapeHtml(code.trimEnd())}</code></pre>`,
      )
      .replace(
        /`([^`]+)`/g,
        (_m, c: string) => `<code>${escapeHtml(c)}</code>`,
      )
      .replace(/^### (.*?)$/gm, '<h3 class="h3">$1</h3>')
      .replace(/^## (.*?)$/gm, '<h2 class="h2">$1</h2>')
      .replace(/^# (.*?)$/gm, '<h1 class="h1">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/((?:^[-*] .+$\n?)+)/gm, (block) => {
        const items = block
          .split("\n")
          .filter(Boolean)
          .map((line) => `<li>${line.replace(/^[-*] /, "")}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      });
  
  // Clean up trailing newlines after block elements to prevent excessive <br>
  html = html.replace(/(<\/(?:h1|h2|h3|ul|pre)>)\n/g, "$1");
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

  const { messages, streaming, error, sendMessage, reset, queued } = useChat({
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

  const newConversation = useCallback(() => {
    setActiveChat(null);
    reset();
    setInput("");
  }, [reset]);

  const handleSend = useCallback(
    (text: string) => {
      // NB: on N'interdit PLUS l'envoi pendant le streaming. sendMessage gère
      // lui-même la règle à 2 niveaux (file d'attente sur submit isolé, FORCE
      // sur double-submit rapide). Le textarea reste actif en permanence.
      if (!text.trim()) return;
      setInput("");
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
    [sendMessage],
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
          <p className="ct-placeholder">
            Hearst Assistant
            {productName ? ` — ${productName} context.` : "."}
            <br />
            Ask a question to get started.
          </p>
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
            style={{ color: accent }}
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
          rows={2}
          placeholder="Message the assistant…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="submit"
          className="ct-chat-send"
          // Actif dès qu'il y a du texte — MÊME pendant le streaming, pour
          // permettre la mise en file (1× clic) et le FORCE (double-clic rapide).
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

