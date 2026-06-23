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
  /**
   * Local echo — append a user turn + a fixed assistant reply to the transcript
   * WITHOUT any network call. Used by the client-side fast navigation path: a
   * pure nav gesture is resolved locally, so there is nothing to POST, but the
   * user must still see their message and the ack bubble instantly. Persists
   * both messages best-effort when persistence is configured (parity with the
   * server, which saves the same pair on its own nav short-circuit).
   */
  appendLocal: (userText: string, assistantText: string) => void;
  reset: () => void;
  /** Texte du prompt en file d'attente (1× Entrée pendant une réponse), sinon null. */
  queued: string | null;
}

/** Fenêtre (ms) sous laquelle deux submits successifs comptent comme un
 *  double-submit → FORCE (abort de la réponse en cours + envoi immédiat). */
const DOUBLE_SUBMIT_MS = 500;

/** Nombre max de messages d'historique POSTés. DOIT rester ≤ au plafond serveur
 *  (`MAX_MESSAGES` dans /api/cockpit-chat) : sinon une conversation longue envoie
 *  un body > limite → 400 "Invalid request body" sur CHAQUE envoi → chat mort. */
const MAX_CLIENT_HISTORY = 30;

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

// Canvas events ride the SAME in-band multiplexer as product charts. The guard
// lives in the shared contract (`@/lib/canvas/contract`) so the server emitter
// and this client splitter can never drift — the contract is imported across
// the @hearst/cockpit-shell alias boundary (this file already imports `@/...`).
import { isCanvasStateEvent, type CanvasStateEvent } from "@/lib/canvas/contract";

type ChatStreamEvent =
  | { type: "product_chart"; chart: ChatChart }
  | CanvasStateEvent;

function isChatStreamEvent(value: unknown): value is ChatStreamEvent {
  if (!value || typeof value !== "object") return false;
  if (isCanvasStateEvent(value)) return true;
  const event = value as Partial<{ type: "product_chart"; chart: ChatChart }>;
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
  /** Prompt en file d'attente (visible côté UI via `queued`). */
  const [queued, setQueued] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  /** Guard anti-race-condition : empêche un double-envoi concurrent. */
  const pendingRef = useRef<boolean>(false);
  /** Timestamp du dernier submit — détecte le double-submit (< 500ms → FORCE). */
  const lastSubmitAtRef = useRef<number>(0);
  /** Un seul prompt en attente : remplacé si un nouveau arrive avant la fin. */
  const queuedRef = useRef<string | null>(null);
  /** Ref stable vers la fonction réseau (runTurn) — câblée plus bas, lue dans
   *  le `finally` pour relancer le prompt en file sans dépendance circulaire. */
  const runTurnRef = useRef<((text: string) => Promise<void>) | null>(null);
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
    queuedRef.current = null;
    setQueued(null);
    setMessages([WELCOME_MSG]);
    setError(null);
    setStreaming(false);
    setChatId(null);
  }, []);

  /**
   * appendLocal — push a user turn + a fixed assistant reply locally, with NO
   * network call. The client fast-nav path resolves a pure navigation gesture
   * (or an instant nav-reject) without the server, so there is nothing to stream
   * — but the transcript must still reflect the exchange instantly. We add both
   * bubbles to the in-memory list and persist them best-effort (fire-and-forget)
   * when a persistence adapter is configured, so reloading the conversation
   * shows the same pair the server would have saved on its own nav shortcut.
   */
  const appendLocal = useCallback(
    (userText: string, assistantText: string) => {
      const user = userText.trim();
      const assistant = assistantText.trim();
      if (!user || !assistant) return;

      const userMsg: DisplayMessage = {
        id: generateId(),
        role: "user",
        content: user,
        createdAt: Date.now(),
      };
      const assistantMsg: DisplayMessage = {
        id: generateId(),
        role: "assistant",
        content: assistant,
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      const activeChatId = chatId;
      if (activeChatId && persistence) {
        void persistence.saveMessage(activeChatId, userMsg).catch(() => {
          /* best-effort persistence — the in-memory echo already happened */
        });
        void persistence.saveMessage(activeChatId, assistantMsg).catch(() => {
          /* best-effort persistence */
        });
      }
    },
    [chatId, persistence],
  );

  /**
   * runTurn — exécute UN tour réseau (envoi + lecture du stream). Ne décide PAS
   * de la mise en file / du force : c'est le rôle du `sendMessage` public.
   * Au démarrage il consomme `pendingRef` ; dans le `finally`, si un prompt a
   * été mis en file pendant ce tour, il le relance (drain de la queue).
   */
  const runTurn = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

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

      // Borne + filtre l'historique POSTé : on retire les bulles vides (ex. un
      // placeholder assistant d'un tour précédent annulé/bloqué — que le schéma
      // serveur rejetait, ce qui bloquait toute la conversation) et on ne garde
      // que les MAX_CLIENT_HISTORY derniers tours, pour ne jamais dépasser la
      // fenêtre acceptée côté serveur.
      const history = messagesRef.current
        .filter((m) => m.content.trim().length > 0)
        .slice(-MAX_CLIENT_HISTORY)
        .map((m) => ({
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
            setError("Too many requests — try again in a few seconds.");
          } else {
            const errData = (await resp
              .json()
              .catch(() => null)) as { error?: string } | null;
            setError(errData?.error ?? "Server error — try again in a moment.");
          }
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          return;
        }

        if (!resp.body) {
          setError("Server error — try again in a moment.");
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
          if (event.type === "canvas_state") {
            // The canvas renders in Section 2 (a different React tree from this
            // chat bubble in Section 3). The shell's chat↔Section-2 seam is
            // window CustomEvents (same pattern as `cockpit:nav-local`), never
            // props — so re-broadcast and let <CanvasLive> upsert. Display-only:
            // a malformed frame can never trigger a write (the action button's
            // two-step token is the only mutation path).
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("cockpit:canvas-state", { detail: event.canvas }),
              );
            }
            return;
          }
          // product_chart — upsert into the assistant message.
          const chart = event.chart;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    charts: appendOrReplaceChart(m.charts, chart),
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
            const errMsg = errPart.split("\n")[0]?.trim() || "Server error — try again in a moment.";
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
        // Identity guard : si un FORCE (double-submit) a déjà remplacé le
        // contrôleur courant par un nouveau tour, CE tour-ci est obsolète et ne
        // doit toucher NI pendingRef NI streaming NI la queue — sinon il
        // écraserait l'état du tour forcé qui vient de démarrer.
        if (abortRef.current !== controller) {
          return;
        }
        abortRef.current = null;
        pendingRef.current = false;
        // Drain de la queue : un prompt mis en attente (1× Entrée pendant la
        // réponse) part automatiquement maintenant que le tour est terminé.
        const next = queuedRef.current;
        queuedRef.current = null;
        if (mountedRef.current) {
          setQueued(null);
          if (next && next.trim()) {
            // Enchaîne sans laisser `streaming` retomber à false entre les deux
            // (l'UI reste en état "en cours"). On NE remet pas streaming=false.
            void runTurnRef.current?.(next);
          } else {
            setStreaming(false);
          }
        }
      }
    },
    // messagesRef est stable — pas besoin de messages dans les deps.
    [apiEndpoint, chatId, productId, onChatId],
  );

  // Garde la ref runTurn à jour pour le drain de queue dans le `finally`.
  runTurnRef.current = runTurn;

  /**
   * sendMessage — point d'entrée public. Applique la règle à 2 niveaux :
   *
   *  - Aucun tour en cours          → envoie immédiatement (runTurn).
   *  - Tour en cours + submit isolé → MET EN FILE (un seul slot, remplacé si un
   *    nouveau arrive). Part automatiquement à la fin du tour courant. La
   *    réponse en cours n'est PAS annulée.
   *  - Tour en cours + double-submit rapide (< 500ms depuis le dernier submit)
   *    → FORCE : abort de la réponse en cours + envoi immédiat du nouveau prompt.
   *
   * Le 2e submit rapide remplace aussi tout prompt déjà en file (on ne veut pas
   * un envoi fantôme en plus du forcé).
   */
  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const now = Date.now();
      const sinceLast = now - lastSubmitAtRef.current;
      lastSubmitAtRef.current = now;

      // Aucun tour en cours → envoi direct.
      if (!pendingRef.current) {
        runTurn(trimmed);
        return;
      }

      // Tour en cours. Double-submit rapide → FORCE.
      if (sinceLast < DOUBLE_SUBMIT_MS) {
        queuedRef.current = null;
        setQueued(null);
        // abort() déclenche le rejet AbortError du fetch en cours ; le `finally`
        // de ce tour videra pendingRef. On relance immédiatement : runTurn
        // re-pose pendingRef=true avant tout await, donc pas de double-envoi.
        abortRef.current?.abort();
        runTurn(trimmed);
        return;
      }

      // Submit isolé pendant un tour → met en file (remplace l'éventuel précédent).
      queuedRef.current = trimmed;
      setQueued(trimmed);
    },
    [runTurn],
  );

  return { messages, streaming, error, sendMessage, appendLocal, reset, queued };
}
