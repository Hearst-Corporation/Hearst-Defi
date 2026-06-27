"use client";

/**
 * ChatHistory — vue historique du rail droit.
 * Liste les conversations passées, permet de les reprendre, renommer ou supprimer.
 */

import { useCallback, useEffect, useState } from "react";
import { setView } from "../stores/chatViewStore";
import { setActiveChat } from "../stores/activeChatStore";

interface ChatSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatHistoryProps {
  productColor?: string;
}

export function ChatHistory({ productColor }: ChatHistoryProps = {}) {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cockpit-chats", { cache: "no-store" });
      if (!res.ok) throw new Error("load_failed");
      const data = (await res.json()) as { chats: ChatSummary[] };
      setChats(data.chats);
    } catch {
      setError("Failed to load history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function selectChat(id: string) {
    setActiveChat(id);
    setView("chat");
  }

  async function newChat() {
    setActiveChat(null);
    setView("chat");
  }

  async function deleteChat(id: string) {
    if (!window.confirm("Delete this conversation?")) return;
    try {
      await fetch(`/api/cockpit-chats/${id}`, { method: "DELETE" });
      setChats((prev) => prev.filter((c) => c.id !== id));
    } catch {
      /* silencieux */
    }
  }

  async function clearAll() {
    if (!window.confirm("Clear all conversations? This cannot be undone.")) return;
    try {
      await fetch("/api/cockpit-chats", { method: "DELETE" });
      setChats([]);
    } catch {
      /* silencieux */
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-black p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium text-black transition-opacity duration-150 hover:opacity-90"
          onClick={newChat}
          aria-label="Start new conversation"
          style={{ background: productColor ?? "#A7FB90" }}
        >
          + New conversation
        </button>
        {chats.length > 0 && (
          <button
            type="button"
            className="ml-auto rounded-md border border-white/10 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500 transition-colors duration-150 hover:text-white hover:border-white/20"
            onClick={clearAll}
            title="Clear all"
          >
            Clear all
          </button>
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-[#A7FB90]" />
          <p className="text-[12px] text-zinc-500">Loading history…</p>
        </div>
      )}
      {error && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-white/10 bg-[#15191C] px-4 py-6 text-center">
          <p className="text-[13px] text-zinc-300">{error}</p>
          <button
            type="button"
            className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-zinc-400 transition-colors duration-150 hover:text-white hover:border-white/20"
            onClick={load}
          >
            ↻ Try again
          </button>
        </div>
      )}
      {!loading && !error && chats.length === 0 && (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <p className="text-[12px] leading-relaxed text-zinc-500">
            No conversations yet.<br />
            Start a chat and your history will appear here.
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-1.5">
        {chats.map((c) => (
          <li
            key={c.id}
            className="group flex items-stretch overflow-hidden rounded-lg bg-[#15191C] transition-colors duration-150 hover:bg-white/[0.05]"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 flex-col gap-1 px-3 py-2.5 text-left"
              onClick={() => selectChat(c.id)}
            >
              <div className="flex min-w-0 items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-zinc-500">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="truncate text-[13px] text-zinc-200">{c.title}</span>
              </div>
              <span className="text-[10px] text-zinc-500">{formatDate(c.updated_at)}</span>
            </button>
            <button
              type="button"
              className="flex shrink-0 items-center px-3 text-zinc-600 opacity-0 transition-all duration-150 hover:text-white group-hover:opacity-100"
              onClick={() => deleteChat(c.id)}
              aria-label="Delete conversation"
              title="Delete"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <path d="M1.5 3h10M4.5 3V2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1M5.5 5.5v4M7.5 5.5v4M2.5 3l.5 8a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5l.5-8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}
