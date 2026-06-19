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
    <div className="ct-chat-history">
      <div className="ct-chat-history-actions">
        <button
          type="button"
          className="ct-chat-history-newbtn"
          onClick={newChat}
          aria-label="Start new conversation"
          style={productColor ? { background: productColor } : undefined}
        >
          + New conversation
        </button>
        {chats.length > 0 && (
          <button
            type="button"
            className="ct-chat-history-clearbtn"
            onClick={clearAll}
            title="Clear all"
          >
            Clear all
          </button>
        )}
      </div>

      {loading && <p className="ct-placeholder">Loading…</p>}
      {error && <p className="ct-chat-error">{error}</p>}
      {!loading && !error && chats.length === 0 && (
        <p className="ct-placeholder">
          No conversations yet — start a chat and your history will appear here.
        </p>
      )}

      <ul className="ct-chat-history-list">
        {chats.map((c) => (
          <li key={c.id} className="ct-chat-history-item">
            <button
              type="button"
              className="ct-chat-history-item-main"
              onClick={() => selectChat(c.id)}
            >
              <span className="ct-chat-history-title">{c.title}</span>
              <span className="ct-chat-history-date">{formatDate(c.updated_at)}</span>
            </button>
            <button
              type="button"
              className="ct-chat-history-delete"
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
