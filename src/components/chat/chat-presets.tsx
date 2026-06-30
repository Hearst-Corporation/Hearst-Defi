"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import { probeReviewMode } from "@/lib/admin/review-mode-probe";

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
 *
 * Route-gated probe (perf): the admin chips only matter on admin surfaces, so the
 * GET /api/admin/review-mode probe ONLY runs when the current route is under
 * `/admin`. On the LP cockpit (`/portfolio`, `/vaults`, `/proof-center`, …) the
 * component defaults to the LP set immediately — zero network, no admin probe.
 * This keeps non-admin routes free of the wasted requireAdmin round-trip.
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

/**
 * Pure helper — exported for unit-testing the probe route-gate.
 *
 * The admin chip set only matters on admin surfaces, so the GET
 * /api/admin/review-mode probe should run ONLY when the current route is under
 * `/admin`. On every other route (the LP cockpit: `/portfolio`, `/vaults`,
 * `/proof-center`, `/profile`, …) we never probe — zero requireAdmin round-trip.
 */
export function shouldProbeAdminRole(pathname: string | null | undefined): boolean {
  return pathname?.startsWith("/admin") ?? false;
}

export function ChatPresets({
  onPick,
  masterAgentEnabled = true,
}: {
  /** Pre-fill the chat input with the preset prompt (editable). */
  onPick: (text: string) => void;
  masterAgentEnabled?: boolean;
}) {
  const pathname = usePathname();
  // The admin chip set is only relevant on admin surfaces. Off `/admin` we never
  // probe — default straight to the LP set (no requireAdmin round-trip, no flash).
  const isAdminSurface = shouldProbeAdminRole(pathname);
  const [role, setRole] = useState<Role>(isAdminSurface ? null : "lp");

  useEffect(() => {
    // Non-admin route → LP set already resolved; skip the probe entirely.
    if (!isAdminSurface) return;
    let cancelled = false;
    // Deduped, session-cached admin probe: the GET /api/admin/review-mode round
    // trip happens at most once per session and is shared with the admin chat
    // controls — re-mounts (and the LP majority's repeat visits) resolve from
    // cache with zero network. Fails closed → LP read starters only.
    void probeReviewMode().then((result) => {
      if (!cancelled) setRole(result.isAdmin ? "admin" : "lp");
    });
    return () => {
      cancelled = true;
    };
  }, [isAdminSurface]);

  // Until the probe resolves (admin surfaces only), render nothing (avoids
  // flashing admin chips at LPs). Non-admin routes start at "lp" → no null gap.
  if (role === null) return null;

  const presets = role === "admin" ? ADMIN_PRESETS : LP_PRESETS;

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Quick actions">
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          disabled={!masterAgentEnabled}
          onClick={() => onPick(preset.prompt)}
          className={cn(
            "rounded-full border border-[var(--ct-border)] bg-surface-inset px-3 py-2 text-[length:var(--ct-text-xs)] text-[var(--ct-text-body)] transition-colors duration-150 hover:border-[var(--ct-border-strong)] hover:bg-white/[0.06] hover:text-white",
            !masterAgentEnabled && "cursor-not-allowed opacity-[var(--ct-opacity-35)] hover:border-[var(--ct-border)] hover:bg-surface-inset hover:text-[var(--ct-text-body)]",
          )}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
