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

    const poll = async (): Promise<void> => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) return;

      let gotDirective = false;

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
            secondaryRoute?: string;
            secondaryLabel?: string;
            secondaryHint?: string;
          };

          if (!cancelled && data.route) {
            const current = pathRef.current;
            if (data.route !== current) {
              // anti-loop: already here → treat as empty (keep backing off)
              const routeWithParams =
                data.route === "/admin/scenario-lab" ||
                data.route === "/admin/product-workspace"
                  ? (() => {
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
                      return query.length > 0 ? `${data.route}?${query}` : data.route;
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
      }

      if (cancelled) return;

      // Advance the backoff delay before scheduling the next poll.
      delay = nextPollDelay(gotDirective, delay, POLL_MS, POLL_MAX_MS);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void poll(); }, delay);
    };

    // Re-arm helper: reset delay to POLL_MS, cancel any pending timer, fire immediately.
    // Used by both the visibilitychange handler and the cockpit:chat-sent listener.
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

    // Kick off the first poll immediately.
    void poll();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("cockpit:chat-sent", onChatSent);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("cockpit:chat-sent", onChatSent);
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
        "shadow-(--ct-shadow-elevated)",
        "border border-(--ct-border)",
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
        className="rounded-full bg-(--ct-accent) px-[var(--ct-space-3)] py-[var(--ct-space-1)] body-xs font-medium ct-text-on-accent"
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
