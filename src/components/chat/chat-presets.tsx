"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * Empty-state quick-action chips for the cockpit chat.
 *
 * A chip PRE-FILLS the chat input (editable, not auto-sent) via `onPick`. Admin
 * chips carry a stable marker (`[[canvas:<id>]]`) that the chat route detects to
 * open the matching agent canvas in Section 2; LP chips are plain read starters.
 *
 * Role is resolved by the lazy admin probe (`GET /api/admin/review-mode` → 200
 * means admin) — display-only, fails CLOSED (network error → LP set). It is NOT
 * a security boundary: the server gates canvas access (admin layout `notFound`)
 * and every write (chat-tools `requireAdmin` + the HITL token). When the chat
 * kill-switch is off, every chip is disabled.
 */

interface Preset {
  id: string;
  label: string;
  /** Text injected into the input. Admin presets prefix the canvas marker. */
  prompt: string;
}

const ADMIN_PRESETS: readonly Preset[] = [
  {
    id: "create-vault",
    label: "Create a product",
    prompt:
      "[[canvas:create-vault]] Help me frame a new vault and create it as a draft.",
  },
  {
    id: "outreach",
    label: "Launch outreach",
    prompt:
      "[[canvas:outreach]] Help me set up a distributor outreach campaign (human-in-the-loop).",
  },
];

const LP_PRESETS: readonly Preset[] = [
  {
    id: "yield-explainer",
    label: "Explain the yield",
    prompt:
      "[[canvas:lp-yield-explainer]] Explain how this vault generates its yield.",
  },
  {
    id: "risk-assessment",
    label: "Risk assessment",
    prompt: "What are the primary risks associated with this vault?",
  },
  {
    id: "distributions",
    label: "Recent distributions",
    prompt: "Show me the recent distributions for my active positions.",
  },
  {
    id: "show-portfolio",
    label: "Show my portfolio",
    prompt: "Take me to my portfolio.",
  },
];

type Role = "admin" | "lp" | null;

export function ChatPresets({
  onPick,
  masterAgentEnabled = true,
}: {
  /** Pre-fill the chat input with the preset prompt (editable). */
  onPick: (text: string) => void;
  masterAgentEnabled?: boolean;
}) {
  const [role, setRole] = useState<Role>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/review-mode");
        if (!cancelled) setRole(res.ok ? "admin" : "lp");
      } catch {
        if (!cancelled) setRole("lp"); // fail closed → LP read starters only
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Until the probe resolves, render nothing (avoids flashing admin chips at LPs).
  if (role === null) return null;

  const presets = role === "admin" ? ADMIN_PRESETS : LP_PRESETS;

  return (
    <div className="ct-chat-presets" role="group" aria-label="Quick actions">
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          disabled={!masterAgentEnabled}
          onClick={() => onPick(preset.prompt)}
          className={cn(
            "ct-chat-preset-chip",
            !masterAgentEnabled && "ct-chat-preset-chip--disabled",
          )}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
