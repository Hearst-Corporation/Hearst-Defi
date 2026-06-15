"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Markdown } from "@/components/admin/markdown";
import {
  getPendingConfirmationGuardError,
  isValidPendingConfirmation,
  toConfirmationRequestedState,
  toExecutionSuccessState,
  type AdminActionFlowState,
} from "@/components/admin/admin-chat-actions-flow";
import { cn } from "@/lib/cn";
import type { ChatMode } from "@/lib/llm/chat-modes";
import type { AdminWriteToolId } from "@/lib/llm/tools/types";

type Mode = ChatMode;
type AdminReadUtilityToolId =
  | "generate_chart_spec"
  | "generate_demo_plan"
  | "export_demo_pack"
  | "export_briefing_pack";

interface ReadUtilitySummary {
  toolId: "export_demo_pack" | "export_briefing_pack";
  generatedAt: string | null;
  counts: Array<{ label: string; value: number }>;
}

interface ReadUtilityInput {
  objective: string;
  audience: string;
}

interface ExportDemoPackInput extends ReadUtilityInput {
  includeCharts?: boolean;
  includeChecklist?: boolean;
}

interface ExportBriefingPackInput extends ReadUtilityInput {
  includeCharts?: boolean;
}

const EXPORT_PACK_TOOL_IDS = new Set<ReadUtilitySummary["toolId"]>([
  "export_demo_pack",
  "export_briefing_pack",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toCountLabel(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
}

function buildReadUtilityInput(
  toolId: AdminReadUtilityToolId,
  params: {
    chartIntent: string;
    chartType: string;
    chartTimeframe: string;
    demoObjective: string;
    demoAudience: string;
    demoPackIncludeCharts: boolean;
    demoPackIncludeChecklist: boolean;
  },
): unknown {
  if (toolId === "generate_chart_spec") {
    return {
      intent: params.chartIntent.trim(),
      chartType: params.chartType,
      ...(params.chartTimeframe.trim().length > 0
        ? { timeframe: params.chartTimeframe.trim() }
        : {}),
    };
  }

  const base: ReadUtilityInput = {
    objective: params.demoObjective.trim(),
    audience: params.demoAudience.trim(),
  };
  if (toolId === "generate_demo_plan") return base;

  if (toolId === "export_demo_pack") {
    const payload: ExportDemoPackInput = {
      ...base,
      includeCharts: params.demoPackIncludeCharts,
      includeChecklist: params.demoPackIncludeChecklist,
    };
    return payload;
  }

  const payload: ExportBriefingPackInput = {
    ...base,
    includeCharts: params.demoPackIncludeCharts,
  };
  return payload;
}

export function getReadUtilitySummary(rawJson: string): ReadUtilitySummary | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const toolIdCandidate =
    typeof parsed.executedToolId === "string"
      ? parsed.executedToolId
      : typeof parsed.requestedToolId === "string"
        ? parsed.requestedToolId
        : null;
  if (!toolIdCandidate || !EXPORT_PACK_TOOL_IDS.has(toolIdCandidate as never)) {
    return null;
  }
  const toolId = toolIdCandidate as ReadUtilitySummary["toolId"];
  const payload = isRecord(parsed.payload) ? parsed.payload : null;
  const metadata = payload && isRecord(payload.metadata) ? payload.metadata : null;
  const generatedAt =
    metadata && typeof metadata.generatedAt === "string"
      ? metadata.generatedAt
      : null;

  const counts = payload
    ? Object.entries(payload).flatMap(([key, value]) =>
        Array.isArray(value)
          ? [{ label: toCountLabel(key), value: value.length }]
          : [],
      )
    : [];

  return {
    toolId,
    generatedAt,
    counts,
  };
}

interface PendingConfirmation {
  toolId: AdminWriteToolId;
  token: string;
  expiresAtIso: string;
  summary: string;
  input: Record<string, unknown>;
}

/** `false` on the server + first client render, `true` after hydration — gates
 * the client-only portal so it never causes an SSR mismatch. */
const emptySubscribe = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/**
 * Tracks the live mount node of the cockpit chat SETTINGS panel
 * (`.ct-chat-settings`, rendered by `@hearst/cockpit-shell` only while the
 * chat "réglages" view is open). Returns the element when the settings view is
 * visible, `null` otherwise. A MutationObserver on <body> keeps it in sync as
 * the user toggles the gear in/out of the settings view.
 */
function useChatSettingsAnchor(): Element | null {
  const [anchor, setAnchor] = useState<Element | null>(null);

  useEffect(() => {
    const resolve = () => {
      const el = document.querySelector(".ct-chat-settings");
      setAnchor((prev) => (prev === el ? prev : el));
    };
    resolve();
    const observer = new MutationObserver(resolve);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return anchor;
}

/**
 * Admin chat mode controls for the Cockpit chat, rendered as a native section AT
 * THE END of the chat SETTINGS panel ("réglages" view of the right rail) —
 * NOT as a floating sticky toolbar over the conversation. Admin-gated: on mount
 * it calls `GET /api/admin/review-mode` (requireAdmin-protected); a 403 means
 * "not an admin" and the component renders nothing. So only admins ever see it.
 *
 * Visually it adopts the cockpit-shell settings primitives
 * (`ct-chat-settings-section` / `-label` / `-row` / `-hint`) so it reads as a
 * first-class réglage row, appended after the existing settings (API key, …).
 * It only mounts while the settings view is open (anchor present); switching
 * back to the conversation removes the panel and this section with it.
 *
 * In Review mode it exposes a "Générer le document" action that distills the
 * conversation into a structured change doc. Admin mode is an internal ops
 * copilot prompt; it does not add write/deploy tools by itself.
 */
export function AdminChatControls() {
  // null = not yet resolved / not an admin → render nothing.
  const [mode, setMode] = useState<Mode | null>(null);
  const [savingMode, setSavingMode] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [streamingCharCount, setStreamingCharCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [adminActionTool, setAdminActionTool] = useState<AdminWriteToolId>(
    "create_review_note_draft",
  );
  const [actionBusy, setActionBusy] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewAuthor, setReviewAuthor] = useState("");
  const [govVaultDeploymentId, setGovVaultDeploymentId] = useState("");
  const [govActionType, setGovActionType] = useState("");
  const [govJustification, setGovJustification] = useState("");
  const [govProposedBy, setGovProposedBy] = useState("");
  const [govRequiredSigners, setGovRequiredSigners] = useState("1");
  const [govCalldata, setGovCalldata] = useState("");
  const [readUtilityTool, setReadUtilityTool] =
    useState<AdminReadUtilityToolId>("generate_chart_spec");
  const [readUtilityBusy, setReadUtilityBusy] = useState(false);
  const [readUtilityResult, setReadUtilityResult] = useState<string | null>(null);
  const [chartIntent, setChartIntent] = useState("APY and risk trend");
  const [chartType, setChartType] = useState("line");
  const [chartTimeframe, setChartTimeframe] = useState("30d");
  const [demoObjective, setDemoObjective] = useState("Admin product walkthrough");
  const [demoAudience, setDemoAudience] = useState("Internal stakeholders");
  const [demoPackIncludeCharts, setDemoPackIncludeCharts] = useState(true);
  const [demoPackIncludeChecklist, setDemoPackIncludeChecklist] = useState(true);

  const getActionFlowState = useCallback(
    (): AdminActionFlowState => ({
      pendingConfirmation,
      actionResult,
      error,
    }),
    [pendingConfirmation, actionResult, error],
  );

  const applyActionFlowState = useCallback((next: AdminActionFlowState) => {
    setPendingConfirmation(next.pendingConfirmation);
    setActionResult(next.actionResult);
    setError(next.error);
  }, []);

  // Anchor into the chat settings panel; null while the settings view is closed.
  const target = useChatSettingsAnchor();

  // Resolve admin status + current mode the FIRST time the chat settings panel
  // is opened — never at page load. This component mounts globally on every
  // product surface, so a fire-at-mount GET would hit the requireAdmin-gated
  // route for every visitor on every page: a guaranteed 403 in the console for
  // the LP majority, who never see this control. Gating on `target` ties the
  // probe to a deliberate "open settings" action. The route stays the
  // authoritative gate: 200 → admin (use the returned mode); anything else
  // (403 non-admin, 401 logged-out) → stay null → render nothing.
  useEffect(() => {
    if (!target || mode !== null) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/review-mode");
        if (!res.ok) return;
        const data = (await res.json().catch(() => null)) as
          | { mode?: Mode }
          | null;
        if (!cancelled) {
          setMode(
            data?.mode === "review" || data?.mode === "admin"
              ? data.mode
              : "normal",
          );
        }
      } catch {
        // Network error → leave null (hidden). Non-fatal.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target, mode]);

  const switchMode = useCallback(
    async (next: Mode) => {
      setError(null);
      setSavingMode(true);
      // Snapshot the value BEFORE the optimistic update so the rollback
      // restores it textually on failure. The previous logic inferred the
      // previous value from `next`, which mis-rolled-back if the user
      // clicked again during the in-flight request.
      const previous = mode;
      setMode(next);
      try {
        const res = await fetch("/api/admin/review-mode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: next }),
        });
        if (!res.ok) {
          // A non-ok response only rolls the optimistic toggle back — there is
          // no navigation side-effect here. 429 = the route's per-admin write
          // cap; surface a specific, non-alarming message for it.
          setError(
            res.status === 429
              ? "Trop de requêtes — réessayez dans un instant."
              : "Impossible d'enregistrer le mode.",
          );
          setMode(previous);
        }
      } catch {
        setError("Impossible d'enregistrer le mode.");
        setMode(previous);
      } finally {
        setSavingMode(false);
      }
    },
    [mode],
  );

  // AbortController for the in-flight generation. Lets the admin cancel a
  // pending 60s call instead of staring at a frozen spinner.
  const abortRef = useRef<AbortController | null>(null);
  const writeActionInFlightRef = useRef(false);
  const readUtilityInFlightRef = useRef(false);

  const generateDocument = useCallback(async () => {
    setError(null);
    setGenerating(true);
    setStreamingCharCount(0);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/admin/review-document?stream=1", {
        method: "POST",
        signal: controller.signal,
        headers: { Accept: "text/event-stream" },
      });

      if (res.headers.get("content-type")?.includes("text/event-stream")) {
        if (!res.body) throw new Error("Réponse de stream vide");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalMd: string | null = null;
        let accumulated = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const evt of events) {
            const line = evt.trim();
            if (!line.startsWith("data: ")) continue;
            try {
              const payload = JSON.parse(line.slice(6)) as {
                type: string;
                text?: string;
                documentId?: string;
                contentMd?: string;
                message?: string;
              };
              if (payload.type === "delta" && payload.text) {
                accumulated += payload.text;
                setStreamingCharCount(accumulated.length);
              } else if (payload.type === "done") {
                finalMd = payload.contentMd ?? null;
              } else if (payload.type === "error") {
                throw new Error(payload.message ?? "Erreur de génération");
              }
            } catch (parseErr) {
              if (parseErr instanceof Error && parseErr.name !== "SyntaxError") {
                throw parseErr;
              }
              // ignore malformed SSE events
            }
          }
        }

        if (!finalMd) throw new Error("Stream terminé sans document final");
        setDoc(finalMd);
        setPanelOpen(true);
      } else {
        // JSON fallback branch (backward-compatible)
        const data = (await res.json().catch(() => null)) as
          | { document?: { contentMd: string }; error?: string }
          | null;
        if (!res.ok || !data?.document) {
          throw new Error(data?.error ?? "Échec de la génération.");
        }
        setDoc(data.document.contentMd);
        setPanelOpen(true);
      }

      // Auto-reset to "normal" after a successful generation: the review is
      // finished, the doc is captured, leaving the admin in facilitator mode
      // would turn subsequent chats into a probing interview rather than
      // assistance. Fire-and-forget — a failure here doesn't break the doc.
      void fetch("/api/admin/review-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "normal" }),
      }).then((r) => {
        if (r.ok) setMode("normal");
      });
    } catch (err) {
      // Distinguish user-initiated abort from a real failure.
      if (err instanceof Error && err.name === "AbortError") {
        setError("Génération annulée.");
      } else {
        setError(
          err instanceof Error ? err.message : "Échec de la génération.",
        );
      }
    } finally {
      setGenerating(false);
      setStreamingCharCount(0);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, []);

  const buildWriteInput = useCallback((): Record<string, unknown> | null => {
    if (adminActionTool === "create_review_note_draft") {
      if (reviewTitle.trim().length === 0 || reviewBody.trim().length === 0) {
        setError("Titre et contenu sont requis.");
        return null;
      }
      return {
        title: reviewTitle.trim(),
        body: reviewBody.trim(),
        ...(reviewAuthor.trim().length > 0 ? { author: reviewAuthor.trim() } : {}),
      };
    }

    const requiredSignersNum = Number.parseInt(govRequiredSigners, 10);
    if (
      govVaultDeploymentId.trim().length === 0 ||
      govActionType.trim().length === 0 ||
      govJustification.trim().length < 20 ||
      govProposedBy.trim().length === 0 ||
      !Number.isInteger(requiredSignersNum) ||
      requiredSignersNum <= 0
    ) {
      setError("Champs gouvernance invalides (justification >= 20 chars).");
      return null;
    }
    return {
      vaultDeploymentId: govVaultDeploymentId.trim(),
      actionType: govActionType.trim(),
      justification: govJustification.trim(),
      proposedBy: govProposedBy.trim(),
      requiredSigners: requiredSignersNum,
      ...(govCalldata.trim().length > 0 ? { calldata: govCalldata.trim() } : {}),
    };
  }, [
    adminActionTool,
    reviewTitle,
    reviewBody,
    reviewAuthor,
    govVaultDeploymentId,
    govActionType,
    govJustification,
    govProposedBy,
    govRequiredSigners,
    govCalldata,
  ]);

  const requestWriteConfirmation = useCallback(async () => {
    if (writeActionInFlightRef.current) return;
    setError(null);
    setActionResult(null);
    const input = buildWriteInput();
    if (!input) return;
    writeActionInFlightRef.current = true;
    setActionBusy(true);
    try {
      const res = await fetch("/api/admin/chat-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "execute_write",
          toolId: adminActionTool,
          input,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            status?: string;
            confirmation?: {
              token: string;
              expiresAtIso: string;
              summary: string;
            };
            error?: string;
          }
        | null;
      if (!res.ok || data?.status !== "confirmation_required" || !data.confirmation) {
        throw new Error(data?.error ?? "Impossible de demander la confirmation.");
      }
      applyActionFlowState(
        toConfirmationRequestedState(getActionFlowState(), {
          toolId: adminActionTool,
          token: data.confirmation.token,
          expiresAtIso: data.confirmation.expiresAtIso,
          summary: data.confirmation.summary,
          input,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de confirmation.");
    } finally {
      writeActionInFlightRef.current = false;
      setActionBusy(false);
    }
  }, [adminActionTool, buildWriteInput, applyActionFlowState, getActionFlowState]);

  const confirmWriteAction = useCallback(async () => {
    if (!pendingConfirmation || writeActionInFlightRef.current) return;
    const confirmationGuardError =
      getPendingConfirmationGuardError(pendingConfirmation);
    if (confirmationGuardError) {
      applyActionFlowState({
        ...getActionFlowState(),
        pendingConfirmation: null,
        actionResult: null,
        error: confirmationGuardError,
      });
      return;
    }
    setError(null);
    setActionResult(null);
    writeActionInFlightRef.current = true;
    setActionBusy(true);
    try {
      const res = await fetch("/api/admin/chat-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "execute_write",
          toolId: pendingConfirmation.toolId,
          input: pendingConfirmation.input,
          confirmedToken: pendingConfirmation.token,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            status?: string;
            result?: { title?: string; createdEntityId?: string };
            error?: string;
            code?: string;
          }
        | null;
      if (!res.ok || data?.status !== "executed") {
        throw new Error(
          data?.error ??
            (data?.code ? `Confirmation rejetee: ${data.code}` : "Execution refusee."),
        );
      }
      applyActionFlowState(
        toExecutionSuccessState(
          getActionFlowState(),
          `${data.result?.title ?? "Write action executed"} · id ${data.result?.createdEntityId ?? "n/a"}`,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'execution.");
    } finally {
      writeActionInFlightRef.current = false;
      setActionBusy(false);
    }
  }, [pendingConfirmation, applyActionFlowState, getActionFlowState]);

  const cancelGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const requestReadUtility = useCallback(async () => {
    if (readUtilityInFlightRef.current) return;
    setError(null);
    setReadUtilityResult(null);
    const input = buildReadUtilityInput(readUtilityTool, {
      chartIntent,
      chartType,
      chartTimeframe,
      demoObjective,
      demoAudience,
      demoPackIncludeCharts,
      demoPackIncludeChecklist,
    });
    if (readUtilityTool === "generate_chart_spec" && chartIntent.trim().length === 0) {
      setError("Intent requis pour le chart spec.");
      return;
    }
    if (
      (readUtilityTool === "generate_demo_plan" ||
        readUtilityTool === "export_demo_pack" ||
        readUtilityTool === "export_briefing_pack") &&
      (demoObjective.trim().length === 0 || demoAudience.trim().length === 0)
    ) {
      setError("Champs read utility manquants.");
      return;
    }
    readUtilityInFlightRef.current = true;
    setReadUtilityBusy(true);
    try {
      const executeReadTool = async (toolId: AdminReadUtilityToolId) => {
        const res = await fetch("/api/admin/chat-tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "execute_read",
            toolId,
            input,
          }),
        });
        const data = (await res.json().catch(() => null)) as
          | {
              status?: string;
              result?: { payload?: unknown; title?: string; lines?: string[] };
              error?: string;
            }
          | null;
        return { res, data };
      };
      const requestedToolId = readUtilityTool;
      const executedToolId = requestedToolId;
      const { res, data } = await executeReadTool(requestedToolId);
      if (!res.ok || data?.status !== "executed" || !data.result) {
        throw new Error(data?.error ?? "Read tool execution failed.");
      }
      setReadUtilityResult(
        JSON.stringify(
          {
            requestedToolId,
            executedToolId,
            title: data.result.title,
            lines: data.result.lines,
            payload: data.result.payload ?? null,
          },
          null,
          2,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur read tool.");
    } finally {
      readUtilityInFlightRef.current = false;
      setReadUtilityBusy(false);
    }
  }, [
    readUtilityTool,
    chartIntent,
    chartType,
    chartTimeframe,
    demoObjective,
    demoAudience,
    demoPackIncludeCharts,
    demoPackIncludeChecklist,
  ]);

  // Abort any in-flight generation if the component unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const copyDoc = useCallback(() => {
    if (doc) void navigator.clipboard.writeText(doc);
  }, [doc]);

  const downloadDoc = useCallback(() => {
    if (!doc) return;
    const blob = new Blob([doc], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revue-produit-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [doc]);

  const hydrated = useHydrated();
  const canConfirmPending = isValidPendingConfirmation(pendingConfirmation);
  const readUtilitySummary = readUtilityResult
    ? getReadUtilitySummary(readUtilityResult)
    : null;
  const formattedGeneratedAt =
    readUtilitySummary?.generatedAt &&
    !Number.isNaN(new Date(readUtilitySummary.generatedAt).getTime())
      ? new Date(readUtilitySummary.generatedAt).toLocaleString()
      : readUtilitySummary?.generatedAt ?? "n/a";
  const adminInputClassName =
    "w-full rounded-md border-(--ct-border-strong) ct-surface-1 px-2 py-1 body-xs";
  // Hidden until hydrated and admin status confirmed. The settings-panel
  // section only renders when the réglages view is open (target present), but
  // the error toast + Modal must stay mountable regardless.
  if (!hydrated || mode === null) return null;

  const settingsSection = target
    ? createPortal(
        <section
          className="ct-chat-settings-section"
          aria-label="Mode du chat"
        >
          <div className="ct-chat-settings-label">Mode du chat</div>

          <div
            className="ct-chat-settings-row"
            role="radiogroup"
            aria-label="Mode du chat"
          >
            <button
              type="button"
              onClick={() => switchMode("normal")}
              disabled={savingMode}
              role="radio"
              aria-checked={mode === "normal"}
              className="ct-chat-settings-segment ct-focus-ring"
            >
              Conversation
            </button>
            <button
              type="button"
              onClick={() => switchMode("review")}
              disabled={savingMode}
              role="radio"
              aria-checked={mode === "review"}
              className="ct-chat-settings-segment ct-focus-ring"
            >
              Review
            </button>
            <button
              type="button"
              onClick={() => switchMode("admin")}
              disabled={savingMode}
              role="radio"
              aria-checked={mode === "admin"}
              className="ct-chat-settings-segment ct-focus-ring"
            >
              Admin
            </button>
          </div>

          {mode === "review" ? (
            <>
              <div className="ct-chat-settings-row ct-chat-settings-row--stack">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={generateDocument}
                  disabled={generating}
                >
                  {generating
                    ? streamingCharCount > 0
                      ? `Génération… (${streamingCharCount} chars)`
                      : "Génération…"
                    : "Générer le document"}
                </Button>
              </div>
              {generating ? (
                <div className="ct-chat-settings-row ct-chat-settings-row--stack">
                  <Button
                    variant="ghost"
                    size="lg"
                    className="w-full"
                    onClick={cancelGeneration}
                    aria-label="Annuler la génération en cours"
                  >
                    Annuler
                  </Button>
                </div>
              ) : null}
              {doc && !panelOpen && !generating ? (
                <div className="ct-chat-settings-row ct-chat-settings-row--stack">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full"
                    onClick={() => setPanelOpen(true)}
                  >
                    Voir le document
                  </Button>
                </div>
              ) : null}
              <div className="ct-chat-settings-hint">
                Distille la conversation en plan de modifications structuré.
              </div>
            </>
          ) : mode === "admin" ? (
            <>
              <div className="ct-chat-settings-hint">
                Copilote interne : architecture, allocations, marche disponible,
                deploiements et runbooks. Pas d'execution autonome.
              </div>
              <div className="ct-chat-settings-label mt-2">Actions admin</div>
              <div className="ct-chat-settings-row">
                <select
                  className={adminInputClassName}
                  value={adminActionTool}
                  onChange={(event) => {
                    setAdminActionTool(event.target.value as AdminWriteToolId);
                    setPendingConfirmation(null);
                    setActionResult(null);
                    setError(null);
                  }}
                  disabled={actionBusy}
                  aria-label="Select admin write tool"
                >
                  <option value="create_review_note_draft">
                    Review note draft
                  </option>
                  <option value="create_governance_proposal_draft">
                    Governance proposal draft
                  </option>
                </select>
              </div>
              {adminActionTool === "create_review_note_draft" ? (
                <>
                  <div className="ct-chat-settings-row">
                    <input
                      className={adminInputClassName}
                      placeholder="Title"
                      value={reviewTitle}
                      onChange={(event) => setReviewTitle(event.target.value)}
                      disabled={actionBusy}
                    />
                  </div>
                  <div className="ct-chat-settings-row">
                    <textarea
                      className={adminInputClassName}
                      placeholder="Body"
                      value={reviewBody}
                      onChange={(event) => setReviewBody(event.target.value)}
                      disabled={actionBusy}
                      rows={3}
                    />
                  </div>
                  <div className="ct-chat-settings-row">
                    <input
                      className={adminInputClassName}
                      placeholder="Author (optional)"
                      value={reviewAuthor}
                      onChange={(event) => setReviewAuthor(event.target.value)}
                      disabled={actionBusy}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="ct-chat-settings-row">
                    <input
                      className={adminInputClassName}
                      placeholder="Vault deployment id"
                      value={govVaultDeploymentId}
                      onChange={(event) => setGovVaultDeploymentId(event.target.value)}
                      disabled={actionBusy}
                    />
                  </div>
                  <div className="ct-chat-settings-row">
                    <input
                      className={adminInputClassName}
                      placeholder="Action type"
                      value={govActionType}
                      onChange={(event) => setGovActionType(event.target.value)}
                      disabled={actionBusy}
                    />
                  </div>
                  <div className="ct-chat-settings-row">
                    <textarea
                      className={adminInputClassName}
                      placeholder="Justification (min 20 chars)"
                      value={govJustification}
                      onChange={(event) => setGovJustification(event.target.value)}
                      disabled={actionBusy}
                      rows={3}
                    />
                  </div>
                  <div className="ct-chat-settings-row">
                    <input
                      className={adminInputClassName}
                      placeholder="Proposed by"
                      value={govProposedBy}
                      onChange={(event) => setGovProposedBy(event.target.value)}
                      disabled={actionBusy}
                    />
                  </div>
                  <div className="ct-chat-settings-row">
                    <input
                      className={adminInputClassName}
                      placeholder="Required signers"
                      value={govRequiredSigners}
                      onChange={(event) => setGovRequiredSigners(event.target.value)}
                      disabled={actionBusy}
                    />
                  </div>
                  <div className="ct-chat-settings-row">
                    <textarea
                      className={adminInputClassName}
                      placeholder="Calldata (optional)"
                      value={govCalldata}
                      onChange={(event) => setGovCalldata(event.target.value)}
                      disabled={actionBusy}
                      rows={2}
                    />
                  </div>
                </>
              )}
              <div className="ct-chat-settings-row">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={requestWriteConfirmation}
                  disabled={actionBusy}
                >
                  Request confirmation
                </Button>
              </div>
              {pendingConfirmation ? (
                <>
                  <div className="ct-chat-settings-hint">
                    {pendingConfirmation.summary}
                    <br />
                    Expires: {new Date(pendingConfirmation.expiresAtIso).toLocaleString()}
                  </div>
                  <div className="ct-chat-settings-row">
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      onClick={confirmWriteAction}
                      disabled={actionBusy || !canConfirmPending}
                    >
                      Confirm and execute
                    </Button>
                  </div>
                </>
              ) : null}
              {actionResult ? (
                <div className="ct-chat-settings-hint">{actionResult}</div>
              ) : null}
              <div className="ct-chat-settings-label mt-2">Read utilities</div>
              <div className="ct-chat-settings-row">
                <select
                  className={adminInputClassName}
                  value={readUtilityTool}
                  onChange={(event) => {
                    setReadUtilityTool(event.target.value as AdminReadUtilityToolId);
                    setReadUtilityResult(null);
                    setError(null);
                  }}
                  disabled={readUtilityBusy}
                  aria-label="Select admin read utility tool"
                >
                  <option value="generate_chart_spec">Generate chart spec</option>
                  <option value="generate_demo_plan">Generate demo plan</option>
                  <option value="export_demo_pack">Export demo pack</option>
                  <option value="export_briefing_pack">Export briefing pack</option>
                </select>
              </div>
              {readUtilityTool === "generate_chart_spec" ? (
                <>
                  <div className="ct-chat-settings-row">
                    <input
                      className={adminInputClassName}
                      placeholder="Chart intent"
                      value={chartIntent}
                      onChange={(event) => setChartIntent(event.target.value)}
                      disabled={readUtilityBusy}
                    />
                  </div>
                  <div className="ct-chat-settings-row">
                    <select
                      className={adminInputClassName}
                      value={chartType}
                      onChange={(event) => setChartType(event.target.value)}
                      disabled={readUtilityBusy}
                      aria-label="Select chart type"
                    >
                      <option value="line">line</option>
                      <option value="bar">bar</option>
                      <option value="area">area</option>
                      <option value="stacked_bar">stacked_bar</option>
                      <option value="pie">pie</option>
                    </select>
                  </div>
                  <div className="ct-chat-settings-row">
                    <input
                      className={adminInputClassName}
                      placeholder="Timeframe (optional)"
                      value={chartTimeframe}
                      onChange={(event) => setChartTimeframe(event.target.value)}
                      disabled={readUtilityBusy}
                    />
                  </div>
                </>
              ) : readUtilityTool === "generate_demo_plan" ? (
                <>
                  <div className="ct-chat-settings-row">
                    <input
                      className={adminInputClassName}
                      placeholder="Objective"
                      value={demoObjective}
                      onChange={(event) => setDemoObjective(event.target.value)}
                      disabled={readUtilityBusy}
                    />
                  </div>
                  <div className="ct-chat-settings-row">
                    <input
                      className={adminInputClassName}
                      placeholder="Audience"
                      value={demoAudience}
                      onChange={(event) => setDemoAudience(event.target.value)}
                      disabled={readUtilityBusy}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="ct-chat-settings-row">
                    <input
                      className={adminInputClassName}
                      placeholder="Objective"
                      value={demoObjective}
                      onChange={(event) => setDemoObjective(event.target.value)}
                      disabled={readUtilityBusy}
                    />
                  </div>
                  <div className="ct-chat-settings-row">
                    <input
                      className={adminInputClassName}
                      placeholder="Audience"
                      value={demoAudience}
                      onChange={(event) => setDemoAudience(event.target.value)}
                      disabled={readUtilityBusy}
                    />
                  </div>
                  <div className="ct-chat-settings-row">
                    <label className="body-xs inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={demoPackIncludeCharts}
                        onChange={(event) =>
                          setDemoPackIncludeCharts(event.target.checked)
                        }
                        disabled={readUtilityBusy}
                      />
                      Include charts
                    </label>
                  </div>
                  {readUtilityTool === "export_demo_pack" ? (
                    <div className="ct-chat-settings-row">
                      <label className="body-xs inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={demoPackIncludeChecklist}
                          onChange={(event) =>
                            setDemoPackIncludeChecklist(event.target.checked)
                          }
                          disabled={readUtilityBusy}
                        />
                        Include checklist
                      </label>
                    </div>
                  ) : null}
                </>
              )}
              <div className="ct-chat-settings-row">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={requestReadUtility}
                  disabled={readUtilityBusy}
                >
                  {readUtilityBusy ? "Running utility..." : "Run read utility"}
                </Button>
              </div>
              {readUtilityResult ? (
                <>
                  {readUtilitySummary ? (
                    <div className="ct-chat-settings-row">
                      <div
                        className={cn(
                          "w-full rounded-md border border-(--ct-border-soft)",
                          "ct-surface-1 px-2 py-1 body-xs",
                          "flex flex-wrap items-center gap-x-3 gap-y-1",
                        )}
                        aria-label="Export pack summary"
                      >
                        <span>
                          <span className="opacity-[var(--ct-opacity-70)]">tool</span>:{" "}
                          {readUtilitySummary.toolId}
                        </span>
                        <span>
                          <span className="opacity-[var(--ct-opacity-70)]">generatedAt</span>:{" "}
                          {formattedGeneratedAt}
                        </span>
                        {readUtilitySummary.counts.length > 0 ? (
                          <span>
                            <span className="opacity-[var(--ct-opacity-70)]">counts</span>:{" "}
                            {readUtilitySummary.counts
                              .map((entry) => `${entry.label} ${entry.value}`)
                              .join(" · ")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  <div className="ct-chat-settings-row">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => void navigator.clipboard.writeText(readUtilityResult)}
                    >
                      Copy JSON
                    </Button>
                  </div>
                  <div className="ct-chat-settings-row">
                    <pre
                      className={cn(
                        "w-full max-h-56 overflow-auto rounded-md border border-(--ct-border-soft)",
                        "ct-surface-1 p-2 body-xs",
                      )}
                    >
                      {readUtilityResult}
                    </pre>
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <div className="ct-chat-settings-hint">
              Assistant conversationnel produit/LP avec garde-fous compliance.
            </div>
          )}

          {error ? (
            <div
              className={cn(
                "ct-chat-settings-hint",
                "ct-status-danger",
              )}
              role="alert"
            >
              {error}
            </div>
          ) : null}
        </section>,
        target,
      )
    : null;

  return (
    <>
      {settingsSection}

      <Modal
        isOpen={panelOpen && doc !== null}
        onClose={() => setPanelOpen(false)}
        title="Plan de modifications suggérées"
        headerActions={
          <>
            <Button variant="ghost" size="sm" onClick={copyDoc}>
              Copier
            </Button>
            <Button variant="secondary" size="sm" onClick={downloadDoc}>
              Télécharger .md
            </Button>
          </>
        }
      >
        {doc && <Markdown content={doc} />}
      </Modal>
    </>
  );
}
