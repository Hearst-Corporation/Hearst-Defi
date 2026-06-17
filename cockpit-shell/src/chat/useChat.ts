"use client";

/**
 * useChat.ts — Hook encapsulant toute la logique d'état et de streaming.
 *
 * Extrait de ChatKimi.tsx pour séparer la logique du rendu.
 * Gère : état messages/streaming/error, AbortController, pendingRef
 * (race-condition guard), signal d'erreur stream (\x00ERROR:), chatId.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatChart, ChatMessage, ChatPersistence } from "./types";

// ---------------------------------------------------------------------------
// Types publics
// ---------------------------------------------------------------------------

/** Message affiché dans la liste (identique à ChatMessage). */
export type DisplayMessage = ChatMessage;

export interface UseChatOptions {
  /** Endpoint API. Défaut : "/api/cockpit-chat" */
  apiEndpoint?: string;
  /** chatId existant à charger au mount. */
  chatId?: string | null;
  /** Callback appelé quand un nouveau chatId est attribué. */
  onChatId?: (id: string) => void;
  /** Persistance Supabase / autre. */
  persistence?: ChatPersistence;
  /** productId courant à envoyer avec chaque requête. */
  productId?: string | null;
}

export interface UseChatReturn {
  messages: DisplayMessage[];
  streaming: boolean;
  error: string | null;
  sendMessage: (text: string) => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Helpers locaux (repris de ChatKimi)
// ---------------------------------------------------------------------------

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Filtre stream-safe des blocs `<think>...</think>` (raisonnement interne Kimi).
 */
function makeThinkStripper() {
  let buffer = "";
  let inThink = false;

  return function feed(chunk: string): string {
    buffer += chunk;
    let output = "";
    let i = 0;

    while (i < buffer.length) {
      if (!inThink) {
        const openIdx = buffer.indexOf("<think>", i);
        if (openIdx === -1) {
          const tail = buffer.slice(i);
          const OPEN_TAG = "<think>";
          let holdLen = 0;
          for (
            let prefLen = Math.min(OPEN_TAG.length - 1, tail.length);
            prefLen > 0;
            prefLen--
          ) {
            if (tail.endsWith(OPEN_TAG.slice(0, prefLen))) {
              holdLen = prefLen;
              break;
            }
          }
          output += tail.slice(0, tail.length - holdLen);
          i = buffer.length;
          buffer = holdLen > 0 ? tail.slice(tail.length - holdLen) : "";
          return output;
        }
        output += buffer.slice(i, openIdx);
        inThink = true;
        i = openIdx + 7; // skip '<think>'
      } else {
        const closeIdx = buffer.indexOf("</think>", i);
        if (closeIdx === -1) {
          // Pas de fermeture — on garde pour le prochain feed.
          buffer = buffer.slice(i);
          return output;
        }
        inThink = false;
        i = closeIdx + 8; // skip '</think>'
      }
    }
    buffer = "";
    return output;
  };
}

const CHAT_EVENT_MARKER = "\x00HC_EVENT:";

type ChatStreamEvent = { type: "product_chart"; chart: ChatChart };

function isChatStreamEvent(value: unknown): value is ChatStreamEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<ChatStreamEvent>;
  return event.type === "product_chart" && typeof event.chart?.id === "string";
}

function appendOrReplaceChart(charts: ChatChart[] | undefined, chart: ChatChart): ChatChart[] {
  const current = charts ?? [];
  const index = current.findIndex((item) => item.id === chart.id);
  if (index === -1) return [...current, chart];
  return current.map((item, itemIndex) => (itemIndex === index ? chart : item));
}

function makeChatEventSplitter(onEvent: (event: ChatStreamEvent) => void) {
  let buffer = "";

  return {
    feed(chunk: string): string {
      buffer += chunk;
      let text = "";

      for (;;) {
        const markerIndex = buffer.indexOf(CHAT_EVENT_MARKER);
        if (markerIndex === -1) {
          const hold = Math.min(buffer.length, CHAT_EVENT_MARKER.length - 1);
          const emitLen = buffer.length - hold;
          if (emitLen > 0) {
            text += buffer.slice(0, emitLen);
            buffer = buffer.slice(emitLen);
          }
          return text;
        }

        text += buffer.slice(0, markerIndex);
        const eventStart = markerIndex + CHAT_EVENT_MARKER.length;
        const newlineIndex = buffer.indexOf("\n", eventStart);
        if (newlineIndex === -1) {
          buffer = buffer.slice(markerIndex);
          return text;
        }

        const rawEvent = buffer.slice(eventStart, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        try {
          const parsed = JSON.parse(rawEvent) as unknown;
          if (isChatStreamEvent(parsed)) onEvent(parsed);
        } catch {
          // Malformed app events are ignored; user-visible text keeps streaming.
        }
      }
    },

    flush(): string {
      const tail = buffer;
      buffer = "";
      return tail.startsWith(CHAT_EVENT_MARKER) ? "" : tail;
    },
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const WELCOME_MSG: DisplayMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hearst Connect assistant — ask about portfolio, vaults, proofs, or navigation. I can guide you; I cannot execute transactions.",
  createdAt: 0,
};

export function useChat(opts?: UseChatOptions): UseChatReturn {
  const {
    apiEndpoint = "/api/cockpit-chat",
    chatId: initialChatId = null,
    onChatId,
    persistence,
    productId = null,
  } = opts ?? {};

  // Démarre vide côté SSR pour éviter le mismatch DOMPurify (window absent).
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [streaming, setStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(initialChatId ?? null);

  const abortRef = useRef<AbortController | null>(null);
  /** Guard anti-race-condition : empêche un double-envoi concurrent. */
  const pendingRef = useRef<boolean>(false);
  /** Guard unmount : évite les setState après démontage. */
  const mountedRef = useRef<boolean>(true);
  /** Ref stable vers messages — évite de recréer sendMessage à chaque chunk. */
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Synchronise chatId local avec celui passé en prop (changement depuis l'historique).
  useEffect(() => {
    setChatId(initialChatId ?? null);
  }, [initialChatId]);

  // Charge les messages quand chatId change :
  //   - via la persistance custom si fournie
  //   - sinon via l'endpoint API /api/cockpit-chats/[id]
  //   - aucun chatId → message de bienvenue.
  useEffect(() => {
    let cancelled = false;

    if (!chatId) {
      setMessages([WELCOME_MSG]);
      return;
    }

    if (persistence) {
      persistence
        .loadMessages(chatId)
        .then((loaded) => {
          if (!cancelled) setMessages(loaded.length > 0 ? loaded : [WELCOME_MSG]);
        })
        .catch(() => {
          if (!cancelled) setMessages([WELCOME_MSG]);
        });
    } else {
      fetch(`/api/cockpit-chats/${chatId}`, { cache: "no-store" })
        .then((r) => r.ok ? r.json() : Promise.reject())
        .then((data: { messages?: Array<{ id: string; role: string; content: string; created_at: string }> }) => {
          if (cancelled) return;
          const loaded: DisplayMessage[] = (data.messages ?? []).map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            createdAt: new Date(m.created_at).getTime(),
          }));
          setMessages(loaded.length > 0 ? loaded : [WELCOME_MSG]);
        })
        .catch(() => {
          if (!cancelled) setMessages([WELCOME_MSG]);
        });
    }

    return () => { cancelled = true; };
  }, [chatId, persistence]);

  // Annule tout stream au démontage + marque le composant comme démonté.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    pendingRef.current = false;
    setMessages([WELCOME_MSG]);
    setError(null);
    setStreaming(false);
    setChatId(null);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // Guard race condition : si un envoi est déjà en cours, on ignore.
      if (pendingRef.current) return;
      pendingRef.current = true;

      // Annuler le stream précédent.
      abortRef.current?.abort();
      setError(null);

      const userMsg: DisplayMessage = {
        id: generateId(),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };

      const history = messagesRef.current.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [...prev, userMsg]);

      // Placeholder assistant (skeleton).
      const assistantId = generateId();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          createdAt: Date.now(),
        },
      ]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const stripThink = makeThinkStripper();

      try {
        const resp = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId: chatId ?? undefined,
            message: trimmed,
            messages: history,
            productId: productId ?? undefined,
          }),
          signal: controller.signal,
        });

        // Fix stream error (P3) : status non-2xx.
        if (!resp.ok) {
          if (resp.status === 429) {
            setError("Trop de requêtes — réessaie dans quelques secondes.");
          } else {
            const errData = (await resp
              .json()
              .catch(() => null)) as { error?: string } | null;
            setError(errData?.error ?? "Erreur serveur — réessaie dans un instant.");
          }
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          return;
        }

        if (!resp.body) {
          setError("Erreur serveur — réessaie dans un instant.");
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          return;
        }

        // Récupère le chatId depuis le header si le serveur en a créé un.
        const headerChatId = resp.headers.get("x-chat-id");
        if (headerChatId && headerChatId !== chatId) {
          setChatId(headerChatId);
          onChatId?.(headerChatId);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let assembled = "";
        let streamErrorDetected = false;
        const eventSplitter = makeChatEventSplitter((event) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    charts: appendOrReplaceChart(m.charts, event.chart),
                  }
                : m,
            ),
          );
        });

        // Carry-over buffer pour détecter \x00ERROR: splitté entre chunks TCP.
        const ERROR_MARKER = "\x00ERROR:";
        let errorCarry = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          const rawChunk = decoder.decode(value, { stream: true });

          // Combine le carry précédent avec le nouveau chunk pour détecter le marker splitté.
          const combined = errorCarry + rawChunk;
          const errIdx = combined.indexOf(ERROR_MARKER);
          if (errIdx !== -1) {
            const errPart = combined.slice(errIdx + ERROR_MARKER.length);
            const errMsg = errPart.split("\n")[0]?.trim() || "Erreur serveur — réessaie dans un instant.";
            setError(errMsg);
            streamErrorDetected = true;
            break;
          }
          // Garde la fin de combined (taille marker - 1) pour le prochain chunk.
          const carryLen = Math.min(combined.length, ERROR_MARKER.length - 1);
          errorCarry = combined.slice(combined.length - carryLen);
          // Chunk propre = combined sans la partie réservée au carry.
          const chunk = combined.slice(0, combined.length - carryLen);

          const eventlessChunk = eventSplitter.feed(chunk);
          const filtered = stripThink(eventlessChunk);
          if (filtered) {
            assembled += filtered;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: assembled } : m,
              ),
            );
          }
        }

        if (streamErrorDetected) {
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          return;
        }

        // Flush final UTF-8 + filtre. Réémettre errorCarry (les ≤6 chars retenus
        // pour détecter un marker \x00ERROR: splitté) sinon la fin de chaque
        // réponse est tronquée — à `done`, le carry restant est du texte normal.
        const tail = stripThink(eventSplitter.feed(errorCarry + decoder.decode()) + eventSplitter.flush());
        if (tail) {
          assembled += tail;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: assembled } : m,
            ),
          );
        }

      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        const errMsg = err instanceof Error ? err.message : "Erreur inconnue";
        setError(errMsg);
        // Retire le placeholder vide.
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } finally {
        if (mountedRef.current) {
          setStreaming(false);
        }
        abortRef.current = null;
        pendingRef.current = false;
      }
    },
    // messagesRef est stable — pas besoin de messages dans les deps.
    [apiEndpoint, chatId, productId, onChatId],
  );

  return { messages, streaming, error, sendMessage, reset };
}
