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
  return (
    text
      .replace(
        /```(\w*)\n?([\s\S]*?)```/g,
        (_m, _lang: string, code: string) =>
          `<pre style="background:rgba(0,0,0,0.4);padding:8px 10px;border-radius:6px;overflow-x:auto;font-size:12px;margin:6px 0;border:1px solid rgba(255,255,255,0.08)"><code>${escapeHtml(code.trimEnd())}</code></pre>`,
      )
      .replace(
        /`([^`]+)`/g,
        (_m, c: string) =>
          `<code style="background:rgba(0,0,0,0.35);padding:1px 5px;border-radius:3px;font-size:12px">${escapeHtml(c)}</code>`,
      )
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/((?:^[-*] .+$\n?)+)/gm, (block) => {
        const items = block
          .split("\n")
          .filter(Boolean)
          .map(
            (line) =>
              `<li style="margin:2px 0">${line.replace(/^[-*] /, "")}</li>`,
          )
          .join("");
        return `<ul style="padding-left:16px;margin:4px 0">${items}</ul>`;
      })
      .replace(/\n/g, "<br>")
  );
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

type ApplyAssistantStep = "about" | "platform" | "sizing" | "confirmed";

const APPLY_ASSISTANT_CONTENT: Record<
  ApplyAssistantStep,
  {
    intro: string;
    description: string;
    suggestions: readonly string[];
  }
> = {
  about: {
    intro: "I'm your Hearst Connect assistant.",
    description:
      "I can help you with this step, the information we need, and what comes next.",
    suggestions: [
      "What information is required here?",
      "Who is eligible to apply?",
      "How is my information used?",
      "What comes after I submit?",
    ],
  },
  platform: {
    intro: "I can help frame the platform questions.",
    description:
      "Ask about qualification criteria, platform categories, or how we interpret the answers.",
    suggestions: [
      "What qualifies as a wealth platform here?",
      "How should I think about AUM ranges?",
      "What if our funds usage is mixed?",
      "Why do you ask about live yield products?",
    ],
  },
  sizing: {
    intro: "I can help calibrate sizing and launch timing.",
    description:
      "Ask about first allocation size, timeline expectations, or how the process works after qualification.",
    suggestions: [
      "What vault size is typical for a first allocation?",
      "Can we apply if timing is still exploratory?",
      "How quickly can onboarding start after qualification?",
      "What happens after we choose a timeline?",
    ],
  },
  confirmed: {
    intro: "Your application has been received.",
    description:
      "I can explain what happens next, expected timing, and what your team should prepare.",
    suggestions: [
      "What are the next steps after submission?",
      "How long does review usually take?",
      "What should we prepare before access is granted?",
      "Who can we contact if timing is urgent?",
    ],
  },
};

function readApplyAssistantStep(): ApplyAssistantStep {
  if (typeof window === "undefined") return "about";
  if (window.location.pathname.startsWith("/apply/confirmed")) return "confirmed";

  const progress = document.querySelector('[role="progressbar"]');
  const ariaValueText = progress?.getAttribute("aria-valuetext")?.toLowerCase() ?? "";

  if (ariaValueText.includes("platform")) return "platform";
  if (ariaValueText.includes("sizing")) return "sizing";
  return "about";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatKimi({ productName, productColor }: ChatKimiProps = {}) {
  const [input, setInput] = useState<string>("");
  const [applyStep, setApplyStep] = useState<ApplyAssistantStep>(() =>
    readApplyAssistantStep(),
  );

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

  const { messages, streaming, error, sendMessage, reset } = useChat({
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
      if (!text.trim() || streaming) return;
      setInput("");
      sendMessage(text);
      // Re-focus après envoi.
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [streaming, sendMessage],
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
  const isApplyAssistant =
    typeof window !== "undefined" && window.location.pathname.startsWith("/apply");
  const hasUserMessages = messages.some((message) => message.role === "user");
  const showApplyHelper = isApplyAssistant && !hasUserMessages && !streaming;

  useEffect(() => {
    if (!isApplyAssistant) return;

    const resolve = () => {
      setApplyStep((prev) => {
        const next = readApplyAssistantStep();
        return prev === next ? prev : next;
      });
    };

    resolve();
    const observer = new MutationObserver(resolve);
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["aria-valuetext"],
    });
    return () => observer.disconnect();
  }, [isApplyAssistant]);

  const applyAssistantCopy = APPLY_ASSISTANT_CONTENT[applyStep];

  return (
    <div className={`ct-chat-root${isApplyAssistant ? " ct-chat-root--apply" : ""}`}>
      {/* Action bar */}
      <div className="ct-chat-actionbar">
        <button
          type="button"
          onClick={newConversation}
          title="Nouvelle conversation"
          className="ct-chat-newbtn"
        >
          + Nouveau
        </button>
      </div>

      {/* Messages */}
      <div ref={chatListRef} className="ct-chat-list">
        {messages.length === 0 && !streaming && !isApplyAssistant && (
          <p className="ct-placeholder">
            Assistant Hearst
            {productName ? ` — contexte ${productName}.` : "."}
            <br />
            Pose ta question pour démarrer.
          </p>
        )}

        {showApplyHelper ? (
          <div className="ct-chat-apply">
            <section className="ct-chat-apply-intro">
              <div className="ct-chat-apply-mark">
                <HearstMark size={16} />
              </div>
              <div className="ct-chat-apply-copy">
                <p className="ct-chat-apply-title">{applyAssistantCopy.intro}</p>
                <p className="ct-chat-apply-body">{applyAssistantCopy.description}</p>
              </div>
            </section>

            <section className="ct-chat-apply-group">
              <p className="ct-chat-apply-kicker">Suggested for this step</p>
              <div className="ct-chat-apply-suggestions">
                {applyAssistantCopy.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="ct-chat-apply-suggestion"
                    onClick={() => handleSend(suggestion)}
                  >
                    <span className="ct-chat-apply-suggestion-icon">↗</span>
                    <span>{suggestion}</span>
                    <span className="ct-chat-apply-suggestion-arrow">›</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {!showApplyHelper && messages.map((msg) => {
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
            aria-label="L'assistant réfléchit"
            style={{ color: accent }}
          >
            <HearstMark size={18} />
          </div>
        )}

        {error && (
          <div className="ct-chat-error">
            <p>{error}</p>
            <button type="button" onClick={retryLast} className="ct-chat-retry">
              ↻ Réessayer
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

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
          placeholder={
            isApplyAssistant ? "Ask me anything about this step…" : "Message the assistant…"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={streaming}
        />
        <button
          type="submit"
          className="ct-chat-send"
          disabled={!input.trim() || streaming}
          aria-label="Send message"
          style={input.trim() && !streaming ? { background: accent } : undefined}
        >
          {streaming ? (
            <span className="ct-chat-send-dots">
              <span /><span /><span />
            </span>
          ) : (
            <svg
              width="16"
              height="16"
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
    <div className="ct-chat-charts" aria-label="Graphiques générés par le chat">
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

