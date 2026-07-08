"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
import { demoAdvanceTimeline, demoSeedPosition, type DemoTimelineStage } from "./demo-actions";

type DemoControlStage = DemoTimelineStage | "seed";

/**
 * Demo-only control: lets Adrien drive the "time machine" lifecycle
 * (reset → +12 months → +24 months → expiry) directly from /portfolio, in
 * front of a client, without a terminal. Wraps the same
 * `scripts/demo/timeline.ts` math (via src/lib/demo/timeline-core.ts) behind
 * `demoAdvanceTimeline`, an allowlist-gated Server Action.
 *
 * Rendered ONLY when the server has already resolved `isDemoAccount(session.email)`
 * — see portfolio/page.tsx, which passes that boolean down and never mounts
 * this component for a real investor. The server action re-checks the same
 * allowlist independently (defence in depth), so even if this component were
 * somehow rendered for a non-demo session, the write would still be refused.
 *
 * "Subscribe $250k" closes the Reset → Advance gap: after Reset wipes every
 * position, +12m/+24m/Expiry have nothing to age. This button calls
 * `demoSeedPosition` to re-create a clean $250k opening position, so the full
 * loop (Reset → Subscribe $250k → +12m/+24m/Expiry) works end-to-end from the
 * browser without a terminal.
 */
export function DemoTimelineControl() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingStage, setPendingStage] = useState<DemoControlStage | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  function run(stage: DemoTimelineStage) {
    setFeedback(null);
    setPendingStage(stage);
    startTransition(async () => {
      const result = await demoAdvanceTimeline(stage);
      setPendingStage(null);
      if (!result.ok) {
        setFeedback({ ok: false, text: result.error });
        return;
      }
      setFeedback({ ok: true, text: result.message });
      router.refresh();
    });
  }

  function seed() {
    setFeedback(null);
    setPendingStage("seed");
    startTransition(async () => {
      const result = await demoSeedPosition();
      setPendingStage(null);
      if (!result.ok) {
        setFeedback({ ok: false, text: result.error });
        return;
      }
      setFeedback({ ok: true, text: result.message });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-dashed border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ct-border-soft)] px-2.5 py-1 text-[length:var(--ct-text-nano)] uppercase tracking-widest ct-text-muted">
          Demo control · simulated timeline
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => run("reset")}
          disabled={isPending}
          aria-busy={isPending && pendingStage === "reset"}
        >
          {isPending && pendingStage === "reset" ? "Resetting…" : "Reset (0)"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={seed}
          disabled={isPending}
          aria-busy={isPending && pendingStage === "seed"}
        >
          {isPending && pendingStage === "seed" ? "Subscribing…" : "Subscribe $250k"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => run("12m")}
          disabled={isPending}
          aria-busy={isPending && pendingStage === "12m"}
        >
          {isPending && pendingStage === "12m" ? "Advancing…" : "+12 months"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => run("24m")}
          disabled={isPending}
          aria-busy={isPending && pendingStage === "24m"}
        >
          {isPending && pendingStage === "24m" ? "Advancing…" : "+24 months"}
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => run("expiry")}
          disabled={isPending}
          aria-busy={isPending && pendingStage === "expiry"}
        >
          {isPending && pendingStage === "expiry" ? "Advancing…" : "Expiry"}
        </Button>
      </div>

      <p className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
        Ages this demo position's subscription date, distributions and NAV
        history to simulate elapsed time. Demo accounts only — never available
        to a real investor.
      </p>

      {feedback ? (
        <p
          className={`text-[length:var(--ct-text-nano)] leading-snug ${feedback.ok ? "ct-text-body" : "ct-status-danger"}`}
          role={feedback.ok ? "status" : "alert"}
        >
          {feedback.text}
        </p>
      ) : null}
    </div>
  );
}
