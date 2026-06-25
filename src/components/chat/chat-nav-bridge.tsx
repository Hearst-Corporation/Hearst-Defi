"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { isProtectedRoute } from "@/lib/llm/navigate-tool";
import { cn } from "@/lib/cn";

/**
 * Client half of the Master Agent's auto-navigation.
 *
 * The chat answer streams through the (untouched) cockpit-shell client, which
 * the app cannot tap — so the navigation destination travels out-of-band: the
 * server publishes it to the per-user nav channel, and this bridge polls
 * `/api/chat-nav` to pick it up and drive `router.push`.
 *
 * Guardrails (auto-navigation must never break the app):
 *  - Polling pauses while the tab is hidden.
 *  - Anti-loop: never navigate to the route already shown.
 *  - On an in-progress flow (deposit / onboarding / TOTP — isProtectedRoute) it
 *    does NOT yank the user; it offers a manual "open" button instead.
 *  - Otherwise it auto-navigates after a short, cancellable delay (a toast with
 *    an "Annuler" affordance), so a stray directive can be stopped.
 *
 * Poll cadence:
 *  - Starts at POLL_MS (900 ms) and doubles on each empty/failed poll up to
 *    POLL_MAX_MS (7 200 ms) — idle backoff for genuinely quiet sessions.
 *  - Resets to POLL_MS immediately when:
 *      (a) a navigation directive lands (re-arm for follow-up directives), or
 *      (b) the tab regains focus (visibilitychange), or
 *      (c) a new chat message is sent ("cockpit:chat-sent" window event) — this
 *          is the fix for the bug where an idle bridge in a VISIBLE tab would
 *          wait up to 7.2 s before picking up the directive the agent just published.
 *
 * Timer discipline (no leaks, no double-schedule):
 *  - A single `timer` variable holds the pending setTimeout id.
 *  - Before scheduling the next poll we always clearTimeout(timer) first.
 *  - The `cancelled` flag short-circuits any async continuation that resolves
 *    after the effect has been torn down.
 */

const POLL_MS = 900;
const POLL_MAX_MS = 7_200;
const AUTO_NAV_DELAY_MS = 500;

/**
 * Pure helper — exported for unit-testing.
 *
 * Returns the next backoff delay:
 *  - If a directive was received (gotDirective=true), reset to base.
 *  - Otherwise double the current delay, clamped to max.
 */
export function nextPollDelay(
  gotDirective: boolean,
  current: number,
  base: number,
  max: number,
): number {
  if (gotDirective) return base;
  return Math.min(current * 2, max);
}

/**
 * Pure helper — exported for unit-testing the dedup/coalescing contract.
 *
 * After a poll completes, decide the next action. There is at most ONE poll in
 * flight at a time, so a re-arm requested mid-flight (visibilitychange or
 * cockpit:chat-sent) is coalesced here instead of having opened a second request:
 *  - `kind: "immediate"` → a re-arm was requested while the request was in flight;
 *    reset to base and poll NOW (preserves the low re-arm latency, no duplicate).
 *  - `kind: "backoff"`   → schedule the next poll after `nextPollDelay` (reset to
 *    base on a directive, else doubled toward max).
 */
export function nextPollSchedule(
  args: { reArmRequested: boolean; gotDirective: boolean; currentDelay: number },
  base: number,
  max: number,
): { kind: "immediate"; delay: number } | { kind: "backoff"; delay: number } {
  if (args.reArmRequested) return { kind: "immediate", delay: base };
  return {
    kind: "backoff",
    delay: nextPollDelay(args.gotDirective, args.currentDelay, base, max),
  };
}

interface PendingNav {
  route: string;
  label: string;
  /** true when the current route is an in-progress flow — offer, don't yank. */
  protected: boolean;
  objective?: string;
  autostart?: boolean;
  intentKind?: string;
  secondaryRoute?: string;
  secondaryLabel?: string;
  secondaryHint?: string;
}

export function ChatNavBridge() {
  const router = useRouter();
  const pathname = usePathname();

  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  const [pending, setPending] = useState<PendingNav | null>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Poll the nav channel with adaptive idle backoff.
  useEffect(() => {
    let cancelled = false;
    let delay = POLL_MS;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Dedup guard: at most ONE /api/chat-nav request in flight at any time. The
    // re-arm triggers (visibilitychange, cockpit:chat-sent) fire bursts that used
    // to each start their own poll chain → concurrent duplicate requests for the
    // SAME directive. While a poll is in flight we record `reArmRequested` instead
    // of opening a second request; the in-flight poll honours it on completion
    // (reset to base + poll immediately) so re-arm latency is preserved.
    let inFlight = false;
    let reArmRequested = false;

    const poll = async (): Promise<void> => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) return;
      // A request is already open — coalesce instead of duplicating it.
      if (inFlight) {
        reArmRequested = true;
        return;
      }

      let gotDirective = false;
      inFlight = true;

      try {
        const res = await fetch("/api/chat-nav", { cache: "no-store" });
        if (!res.ok) {
          // network / server hiccup — keep backing off
        } else {
          const data = (await res.json()) as {
            route?: string | null;
            label?: string;
            objective?: string;
            autostart?: boolean;
            intentKind?: string;
            canvasId?: string;
            secondaryRoute?: string;
            secondaryLabel?: string;
            secondaryHint?: string;
          };

          if (!cancelled && data.route) {
            const current = pathRef.current;
            if (data.route !== current) {
              // anti-loop: already here → treat as empty (keep backing off)
              // Seeded destinations (scenario lab, product workspace, agent
              // canvas) carry the objective/autostart in the URL so the page can
              // pick it up. The agent-canvas base route also gets the canvasId
              // appended as a path segment (/admin/agent-canvas/<id>).
              const isCanvasRoute =
                data.route === "/agent-canvas" || data.route === "/admin/agent-canvas";
              const isSeededRoute =
                data.route === "/admin/scenario-lab" ||
                data.route === "/admin/product-workspace" ||
                isCanvasRoute;
              const routeWithParams = isSeededRoute
                ? (() => {
                    const base =
                      isCanvasRoute && data.canvasId
                        ? `${data.route}/${data.canvasId}`
                        : data.route!;
                    const params = new URLSearchParams();
                    if (data.autostart) params.set("autostart", "1");
                    if (data.objective && data.objective.trim().length > 0) {
                      params.set("objective", data.objective.trim());
                    }
                    if (data.intentKind) params.set("intent", data.intentKind);
                    if (data.secondaryRoute === "/admin/scenario-lab") {
                      params.set("secondary", "scenario-lab");
                    }
                    if (data.secondaryHint && data.secondaryHint.trim().length > 0) {
                      params.set("secondaryHint", data.secondaryHint.trim());
                    }
                    const query = params.toString();
                    return query.length > 0 ? `${base}?${query}` : base;
                  })()
                : data.route;

              setPending({
                route: routeWithParams,
                label: data.label ?? "the page",
                protected: isProtectedRoute(current),
                ...(data.objective ? { objective: data.objective } : {}),
                ...(data.autostart ? { autostart: true } : {}),
                ...(data.intentKind ? { intentKind: data.intentKind } : {}),
                ...(data.secondaryRoute ? { secondaryRoute: data.secondaryRoute } : {}),
                ...(data.secondaryLabel ? { secondaryLabel: data.secondaryLabel } : {}),
                ...(data.secondaryHint ? { secondaryHint: data.secondaryHint } : {}),
              });

              gotDirective = true;
            }
          }
        }
      } catch {
        // network hiccup — ignore, back off and try again next tick
      } finally {
        inFlight = false;
      }

      if (cancelled) return;

      // Decide the next action — a mid-flight re-arm is coalesced here (immediate
      // re-poll) instead of having opened a duplicate request; otherwise back off.
      const next = nextPollSchedule(
        { reArmRequested, gotDirective, currentDelay: delay },
        POLL_MS,
        POLL_MAX_MS,
      );
      reArmRequested = false;
      delay = next.delay;
      if (timer) clearTimeout(timer);
      if (next.kind === "immediate") {
        void poll();
      } else {
        timer = setTimeout(() => { void poll(); }, delay);
      }
    };

    // Re-arm helper: reset delay to POLL_MS, cancel any pending timer, fire
    // immediately. Used by both visibilitychange and cockpit:chat-sent. If a poll
    // is in flight, poll() coalesces the request via reArmRequested (no duplicate).
    const reArm = (): void => {
      if (cancelled) return;
      delay = POLL_MS;
      if (timer) clearTimeout(timer);
      void poll();
    };

    const onVisible = (): void => {
      if (!document.hidden) reArm();
    };

    const onChatSent = (): void => {
      reArm();
    };

    // Client fast-path: ChatKimi resolved a navigation gesture locally (zero
    // network) and dispatched the resolved ROUTE. We feed it through the SAME
    // pending/auto-nav machinery a server-published directive uses, so the
    // anti-loop check and the protected-route confirmation (offer, don't yank)
    // both still apply — the local path never blindly router.pushes.
    const onNavLocal = (event: Event): void => {
      if (cancelled) return;
      const detail = (event as CustomEvent).detail as
        | { route?: unknown; label?: unknown }
        | undefined;
      const route = typeof detail?.route === "string" ? detail.route : null;
      if (!route) return;
      const current = pathRef.current;
      if (route === current) return; // anti-loop: already here
      const label = typeof detail?.label === "string" ? detail.label : "the page";
      setPending({
        route,
        label,
        protected: isProtectedRoute(current),
      });
    };

    // Kick off the first poll immediately.
    void poll();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("cockpit:chat-sent", onChatSent);
    window.addEventListener("cockpit:nav-local", onNavLocal);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("cockpit:chat-sent", onChatSent);
      window.removeEventListener("cockpit:nav-local", onNavLocal);
    };
  }, []);

  // Auto-navigate on a non-protected route after a cancellable delay.
  useEffect(() => {
    if (!pending || pending.protected) return;
    autoTimer.current = setTimeout(() => {
      router.push(pending.route);
      setPending(null);
    }, AUTO_NAV_DELAY_MS);
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
    };
  }, [pending, router]);

  const cancel = useCallback(() => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    setPending(null);
  }, []);

  const goNow = useCallback(() => {
    if (!pending) return;
    if (autoTimer.current) clearTimeout(autoTimer.current);
    const route = pending.route;
    setPending(null);
    router.push(route);
  }, [pending, router]);

  if (!pending) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-4 left-1/2 z-50 -translate-x-1/2",
        "flex items-center gap-[var(--ct-space-3)] rounded-full px-[var(--ct-space-4)] py-[var(--ct-space-2)]",
        "ct-surface-1 ct-text-primary",
        "shadow-[var(--ct-shadow-elevated)]",
        "border border-[var(--ct-border)]",
      )}
    >
      <span className="body-sm">
        {pending.protected ? (
          <>Go to <strong>{pending.label}</strong> ?</>
        ) : (
          <>Opening <strong>{pending.label}</strong>…</>
        )}
      </span>
      <button
        type="button"
        onClick={goNow}
        className="rounded-full bg-[var(--ct-accent)] px-[var(--ct-space-3)] py-[var(--ct-space-1)] body-xs font-medium ct-text-on-accent"
      >
        {pending.protected ? "Open" : "Now"}
      </button>
      <button
        type="button"
        onClick={cancel}
        className="rounded-full px-[var(--ct-space-2)] py-[var(--ct-space-1)] body-xs ct-text-muted hover:ct-text-strong"
      >
        Cancel
      </button>
    </div>
  );
}
