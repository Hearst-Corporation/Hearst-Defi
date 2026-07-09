"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
import {
  demoAdvanceTimeline,
  demoSeedPosition,
  demoSeedZandFixture,
  type DemoTimelineStage,
} from "./demo-actions";

type DemoControlStage = DemoTimelineStage | "seed" | "fixture";

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
export function DemoTimelineControl({
  showFixtureSeed = false,
}: {
  /** True only for the Zand fixture account — shows the "Seed $2M fixture" lever. */
  showFixtureSeed?: boolean;
} = {}) {
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

  function seedFixture() {
    setFeedback(null);
    setPendingStage("fixture");
    startTransition(async () => {
      const result = await demoSeedZandFixture();
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
    // Bare, discreet margin control — plain ghost levers only, no filled CTAs, so
    // the demo time-machine sits quietly in the top margin and never competes
    // with the console. Feedback is aria-live but visually hidden (no chrome).
    <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
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
        variant="ghost"
        size="sm"
        onClick={seed}
        disabled={isPending}
        aria-busy={isPending && pendingStage === "seed"}
      >
        {isPending && pendingStage === "seed" ? "Subscribing…" : "Subscribe $250k"}
      </Button>
      {showFixtureSeed ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={seedFixture}
          disabled={isPending}
          aria-busy={isPending && pendingStage === "fixture"}
        >
          {isPending && pendingStage === "fixture" ? "Seeding…" : "Seed $2M fixture"}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => run("12m")}
        disabled={isPending}
        aria-busy={isPending && pendingStage === "12m"}
      >
        {isPending && pendingStage === "12m" ? "Advancing…" : "+12 months"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => run("24m")}
        disabled={isPending}
        aria-busy={isPending && pendingStage === "24m"}
      >
        {isPending && pendingStage === "24m" ? "Advancing…" : "+24 months"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => run("expiry")}
        disabled={isPending}
        aria-busy={isPending && pendingStage === "expiry"}
      >
        {isPending && pendingStage === "expiry" ? "Advancing…" : "Expiry"}
      </Button>

      {/* Success stays a11y-only (the refreshed console IS the feedback);
          FAILURES must be visible — a silent no-op reads as "the button is
          broken" (it did, live). Small danger text, no chrome. */}
      {feedback ? (
        feedback.ok ? (
          <span className="sr-only" role="status">
            {feedback.text}
          </span>
        ) : (
          <span
            role="alert"
            className="basis-full text-right text-[length:var(--ct-text-nano)] leading-snug ct-status-danger"
          >
            {feedback.text}
          </span>
        )
      ) : null}
    </div>
  );
}
