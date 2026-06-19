"use client";

import { type KeyboardEvent, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * OutreachCopilot — the in-page command chat for the lead-gen engine.
 *
 * Distinct from the global Section-3 Master Agent: this one is scoped to the
 * outreach workspace and talks to /api/outreach-chat, which can ACT through the
 * same admin Server Actions the buttons use (source / show tier / status) while
 * staying human-in-the-loop (it never sends email). When the server signals
 * `refresh`, we re-pull the page so newly sourced leads appear in the directory.
 *
 * Presentational shell mirrors the apply-assistant pattern (dark, compact),
 * kept inside its own card so it reads as a workspace tool, not the global rail.
 */

interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Source 20 distributor leads",
  "Show the prime leads",
  "Pipeline status",
] as const;

let msgSeq = 0;
function nextId(): string {
  msgSeq += 1;
  return `m${msgSeq}`;
}

/** Minimal inline markdown → safe HTML-free rendering (bold + bullets). */
function renderLine(line: string, key: number) {
  // Bold segments **x**
  const parts = line.split(/(\*\*[^*]+\*\*)/g).map((seg, i) => {
    if (seg.startsWith("**") && seg.endsWith("**")) {
      return <strong key={i}>{seg.slice(2, -2)}</strong>;
    }
    // Italic _x_
    const italic = seg.split(/(_[^_]+_)/g).map((s, j) =>
      s.startsWith("_") && s.endsWith("_") ? (
        <em key={j} className="ct-text-muted">
          {s.slice(1, -1)}
        </em>
      ) : (
        s
      ),
    );
    return <span key={i}>{italic}</span>;
  });
  return (
    <p key={key} className="ct-outreach-copilot-line m-0">
      {parts}
    </p>
  );
}

export function OutreachCopilot() {
  const router = useRouter();
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setInput("");
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "user", content: trimmed },
      ]);
      setBusy(true);
      try {
        const res = await fetch("/api/outreach-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
        });
        const data = (await res.json().catch(() => null)) as {
          reply?: string;
          refresh?: boolean;
          error?: string;
        } | null;
        const reply =
          data?.reply ??
          data?.error ??
          "Something went wrong — try again in a moment.";
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: "assistant", content: reply },
        ]);
        if (data?.refresh) router.refresh();
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            content: "Network error — the copilot is unreachable.",
          },
        ]);
      } finally {
        setBusy(false);
        requestAnimationFrame(() => {
          listRef.current?.scrollTo({
            top: listRef.current.scrollHeight,
            behavior: "smooth",
          });
        });
      }
    },
    [busy, router],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void send(input);
      }
    },
    [input, send],
  );

  return (
    <aside className="ct-outreach-copilot" aria-label="Outreach copilot">
      <header className="ct-outreach-copilot-head">
        <span className="ct-outreach-copilot-head-left">
          <span aria-hidden="true" className="ct-outreach-copilot-dot" />
          <span className="eyebrow ct-text-strong">Outreach copilot</span>
        </span>
        <span className="body-xs ct-text-muted">human-in-the-loop</span>
      </header>

      <div ref={listRef} className="ct-outreach-copilot-list">
        {messages.length === 0 ? (
          <div className="ct-outreach-copilot-intro">
            <span aria-hidden="true" className="ct-outreach-copilot-mark">
              H
            </span>
            <p className="body-sm ct-text-muted m-0">
              I drive the lead engine — sourcing, scoring, tiers. Ask me to find
              leads or show a tier. I never send; you stay in control.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`ct-outreach-copilot-msg ${
                m.role === "user" ? "is-user" : "is-assistant"
              }`}
            >
              {m.content.split("\n").map((line, i) => renderLine(line, i))}
            </div>
          ))
        )}
        {busy && (
          <div className="ct-outreach-copilot-msg is-assistant ct-text-muted body-xs">
            Working…
          </div>
        )}
      </div>

      {messages.length === 0 && (
        <div className="ct-outreach-copilot-suggestions">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => void send(s)}
              className="ct-outreach-copilot-suggestion ct-focus-ring"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="ct-outreach-copilot-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <textarea
          className="ct-outreach-copilot-input"
          rows={2}
          placeholder="Tell the copilot what to do…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
          aria-label="Message the outreach copilot"
        />
        <button
          type="submit"
          className="ct-outreach-copilot-send ct-focus-ring"
          disabled={!input.trim() || busy}
          aria-label="Send"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M8 13V3M8 3L4 7M8 3l4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </form>
    </aside>
  );
}
