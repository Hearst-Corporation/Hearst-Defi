"use client";

import { useCallback, useState } from "react";

import type { PendingActionProposal } from "@/lib/canvas/contract";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

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

  const propose = useCallback(async () => {
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
      }
    } catch (err) {
      setPhase("error");
      setFeedback(err instanceof Error ? err.message : "Action failed.");
    }
  }, [proposal.toolId, proposal.input]);

  const confirm = useCallback(async () => {
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
  }, [proposal.toolId, proposal.input, token]);

  const busy = phase === "proposing" || phase === "executing";

  return (
    <div className="ct-canvas-action">
      <div className="ct-canvas-action-head">
        <span className="ct-canvas-action-label">{proposal.label}</span>
        <span className={cn("ct-canvas-action-risk", `ct-canvas-action-risk--${proposal.riskLevel}`)}>
          {proposal.riskLevel}
        </span>
      </div>

      {/* PTAI — Projection → Trigger → Action → Impact */}
      <dl className="ct-canvas-ptai">
        <div><dt>Projection</dt><dd>{proposal.summary.projection}</dd></div>
        <div><dt>Trigger</dt><dd>{proposal.summary.trigger}</dd></div>
        <div><dt>Action</dt><dd>{proposal.summary.action}</dd></div>
        <div><dt>Impact</dt><dd>{proposal.summary.impact}</dd></div>
      </dl>

      {proposal.willNotDo.length > 0 && (
        <ul className="ct-canvas-willnotdo">
          {proposal.willNotDo.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}

      {(phase === "idle" || phase === "proposing" || phase === "error") && (
        <Button variant="secondary" size="md" disabled={disabled || busy} onClick={propose}>
          {phase === "proposing" ? "Preparing…" : proposal.label}
        </Button>
      )}

      {(phase === "awaiting_confirm" || phase === "executing") && (
        <>
          <div className="ct-canvas-action-confirm">
            <Button variant="primary" size="md" disabled={disabled || busy} onClick={confirm}>
              {phase === "executing" ? "Executing…" : "Confirm"}
            </Button>
            <Button
              variant="ghost"
              size="md"
              disabled={busy}
              onClick={() => {
                setToken(null);
                setPhase("idle");
                setFeedback(null);
              }}
            >
              Cancel
            </Button>
          </div>
          {feedback && <p className="ct-canvas-action-feedback">{feedback}</p>}
        </>
      )}

      {phase === "done" && <p className="ct-canvas-action-done">✓ {feedback}</p>}
      {phase === "error" && <p className="ct-canvas-action-error">{feedback}</p>}
    </div>
  );
}
