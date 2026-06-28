"use client";

import { useCallback, useState } from "react";

import type { PendingActionProposal } from "@/lib/canvas/contract";
import { BENTO_PRIMARY_BTN, BENTO_SECONDARY_BTN } from "@/components/catalyst/bento";
import { cn } from "@/lib/cn";
import { buildOutreachPostDraftMessage } from "@/lib/canvas/outreach-turn";

// Risk chip chrome — bento canon: tinted border + fill + text, kept distinct
// per risk level (honesty: a high-risk write never reads as the accent-green
// "go" colour). low/medium are quiet neutral chips; high is amber.
const RISK_CHIP: Record<PendingActionProposal["riskLevel"], string> = {
  low: "border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] text-[var(--ct-text-muted)]",
  medium:
    "border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] text-[var(--ct-text-body)]",
  high: "border-[color-mix(in_srgb,var(--ct-status-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-status-warning)_10%,transparent)] text-[var(--ct-status-warning)]",
};

/**
 * After a campaign draft is created, inject a DETERMINISTIC post-draft message
 * into the chat (template, no LLM) so the critical "draft created — nothing
 * sourced/sent — next step under confirmation" copy is reliable. useChat listens
 * for this event and appends it as an assistant bubble.
 */
function announceCampaignDraftCreated(proposal: PendingActionProposal): void {
  if (proposal.toolId !== "create_campaign_draft") return;
  if (typeof window === "undefined") return;
  const name =
    typeof proposal.input.name === "string" ? proposal.input.name : "the campaign";
  window.dispatchEvent(
    new CustomEvent("cockpit:chat-append-assistant", {
      detail: { text: buildOutreachPostDraftMessage(name) },
    }),
  );
}

/**
 * The ONLY component in the canvas that touches the network. It owns the
 * two-step HITL flow against the UNCHANGED `/api/admin/chat-tools` route:
 *
 *   Press 1 (propose): POST { action:"execute_write", toolId, input } with NO
 *     token → server validates + mints a payload-hash-bound, single-use,
 *     user-bound confirmation token (status "confirmation_required").
 *   Press 2 (confirm): POST the IDENTICAL { toolId, input } PLUS confirmedToken
 *     → server re-hashes the payload, atomically consumes the token, runs the
 *     real Server Action (status "executed").
 *
 * The proposal carries NO token — it is inert data describing this button. A
 * mutation is impossible without two explicit clicks and a server-minted token.
 * Disabled entirely when the chat kill-switch is off (`disabled` prop, fed from
 * `CanvasState.agentLive`).
 */

type Phase = "idle" | "proposing" | "awaiting_confirm" | "executing" | "done" | "error";

interface ConfirmationRequired {
  status: "confirmation_required";
  toolId: string;
  confirmation: { token: string; expiresAtIso: string; summary: string };
  message?: { title: string; body: string };
}
interface Executed {
  status: "executed";
  toolId: string;
  result: { title: string; lines: string[]; createdEntityId: string };
}

async function postWrite(body: {
  toolId: string;
  input: Record<string, unknown>;
  confirmedToken?: string;
}): Promise<ConfirmationRequired | Executed> {
  const res = await fetch("/api/admin/chat-tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "execute_write", ...body }),
  });
  const data = (await res.json().catch(() => null)) as
    | ConfirmationRequired
    | Executed
    | { error?: string; message?: { body?: string } }
    | null;
  if (!res.ok || !data || !("status" in data)) {
    const msg =
      data && typeof data === "object" && "message" in data && data.message?.body
        ? data.message.body
        : data && typeof data === "object" && "error" in data && data.error
          ? data.error
          : "Action failed.";
    throw new Error(msg);
  }
  return data;
}

export function CanvasActionButton({
  canvasId: _canvasId,
  proposal,
  disabled = false,
}: {
  canvasId: string;
  proposal: PendingActionProposal;
  disabled?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [token, setToken] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const propose = useCallback(async (event?: React.MouseEvent<HTMLButtonElement>) => {
    // HARD guard (WIRE-1): a canvas action button must NEVER bubble into the
    // cockpit chat <form> submit (or any ancestor handler) and re-send its label
    // as a chat message. The button is also explicitly type="button" below, so a
    // missing default type can't turn it into a submit either.
    event?.preventDefault();
    event?.stopPropagation();
    setFeedback(null);
    setPhase("proposing");
    try {
      const r = await postWrite({ toolId: proposal.toolId, input: proposal.input });
      if (r.status === "confirmation_required") {
        setToken(r.confirmation.token);
        setPhase("awaiting_confirm");
        setFeedback(r.message?.body ?? r.confirmation.summary);
      } else {
        // Some tools may execute without a confirmation step; treat as done.
        setPhase("done");
        setFeedback(r.result.lines.join(" "));
        announceCampaignDraftCreated(proposal);
      }
    } catch (err) {
      setPhase("error");
      setFeedback(err instanceof Error ? err.message : "Action failed.");
    }
  }, [proposal]);

  const confirm = useCallback(async (event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (!token) return;
    setFeedback(null);
    setPhase("executing");
    try {
      // Press 2 echoes the IDENTICAL input + the minted token. The server
      // re-hashes the input and rejects any mismatch / reuse / expiry.
      const r = await postWrite({
        toolId: proposal.toolId,
        input: proposal.input,
        confirmedToken: token,
      });
      if (r.status === "executed") {
        setPhase("done");
        setFeedback(r.result.lines.join(" "));
        // Deterministic post-draft chat message (template, no LLM).
        announceCampaignDraftCreated(proposal);
      } else {
        // Token expired / re-mint — surface a re-confirm affordance.
        setToken(r.confirmation.token);
        setPhase("awaiting_confirm");
        setFeedback(r.message?.body ?? "Please confirm again.");
      }
    } catch (err) {
      setPhase("error");
      setToken(null);
      setFeedback(err instanceof Error ? err.message : "Action failed.");
    }
  }, [proposal, token]);

  const busy = phase === "proposing" || phase === "executing";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--ct-border)] bg-surface-inset p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="ct-metric-value font-semibold">{proposal.label}</span>
        <span
          className={cn(
            "ct-bento-label shrink-0 rounded-full border px-2 py-0.5",
            RISK_CHIP[proposal.riskLevel],
          )}
        >
          {proposal.riskLevel}
        </span>
      </div>

      {/* PTAI — Projection → Trigger → Action → Impact */}
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
        <dt className="ct-bento-label">Projection</dt>
        <dd className="ct-metric-caption m-0">{proposal.summary.projection}</dd>
        <dt className="ct-bento-label">Trigger</dt>
        <dd className="ct-metric-caption m-0">{proposal.summary.trigger}</dd>
        <dt className="ct-bento-label">Action</dt>
        <dd className="ct-metric-caption m-0">{proposal.summary.action}</dd>
        <dt className="ct-bento-label">Impact</dt>
        <dd className="ct-metric-caption m-0">{proposal.summary.impact}</dd>
      </dl>

      {proposal.willNotDo.length > 0 && (
        <ul className="ct-metric-caption m-0 flex list-none flex-col gap-0.5 p-0">
          {proposal.willNotDo.map((item, i) => (
            <li key={i} className="before:content-['—_']">
              {item}
            </li>
          ))}
        </ul>
      )}

      {(phase === "idle" || phase === "proposing" || phase === "error") && (
        <button
          type="button"
          className={cn(BENTO_SECONDARY_BTN, "self-start")}
          disabled={disabled || busy}
          onClick={propose}
        >
          {phase === "proposing" ? "Preparing…" : proposal.label}
        </button>
      )}

      {(phase === "awaiting_confirm" || phase === "executing") && (
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={BENTO_PRIMARY_BTN}
              disabled={disabled || busy}
              onClick={confirm}
            >
              {phase === "executing" ? "Executing…" : "Confirm"}
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-[length:var(--ct-text-2xs)] font-medium text-[var(--ct-text-muted)] transition-colors hover:text-[var(--ct-text-strong)] disabled:cursor-not-allowed disabled:opacity-50",
              )}
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setToken(null);
                setPhase("idle");
                setFeedback(null);
              }}
            >
              Cancel
            </button>
          </div>
          {feedback && <p className="ct-metric-caption m-0">{feedback}</p>}
        </>
      )}

      {phase === "done" && (
        <p className="ct-metric-caption m-0 text-[var(--ct-accent)]">✓ {feedback}</p>
      )}
      {phase === "error" && (
        <p className="ct-metric-caption m-0 text-[var(--ct-status-danger)]">
          {feedback}
        </p>
      )}
    </div>
  );
}
