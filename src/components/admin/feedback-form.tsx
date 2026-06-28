"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";

import { BENTO_PRIMARY_BTN, BentoLabel } from "@/components/ui/bento";
import { postFeedback } from "@/app/admin/feedback/actions";

const INPUT_CLASS =
  "ct-metric-value mt-2 w-full rounded-lg border border-[var(--ct-border)] bg-surface-inset px-3 py-2.5 placeholder:text-[var(--ct-text-muted)] transition-colors focus:border-[color-mix(in_srgb,var(--ct-accent)_40%,transparent)] focus:outline-none";

export function FeedbackForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await postFeedback(formData);
        formRef.current?.reset();
        toast.success("Feedback posted");
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Failed to post feedback: ${message}`);
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={onSubmit}
      className="flex flex-col gap-y-5"
      aria-label="Feedback form"
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <label className="block" htmlFor="feedback-itemId">
          <BentoLabel>Related item (optional)</BentoLabel>
          <input
            id="feedback-itemId"
            name="itemId"
            type="text"
            placeholder="e.g. dash-hero"
            className={`${INPUT_CLASS} font-mono`}
          />
        </label>
        <label className="block" htmlFor="feedback-author">
          <BentoLabel>Your name (optional)</BentoLabel>
          <input
            id="feedback-author"
            name="author"
            type="text"
            placeholder="Adrien"
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <label className="block" htmlFor="feedback-pathname">
        <BentoLabel>Page or context (optional)</BentoLabel>
        <input
          id="feedback-pathname"
          name="pathname"
          type="text"
          placeholder="/admin/roadmap"
          className={`${INPUT_CLASS} font-mono`}
        />
      </label>

      <label className="block" htmlFor="feedback-message">
        <BentoLabel>Feedback</BentoLabel>
        <textarea
          id="feedback-message"
          name="message"
          rows={4}
          required
          minLength={2}
          placeholder="What works? What doesn't? What's confusing?"
          className={`${INPUT_CLASS} resize-y leading-relaxed`}
          aria-describedby="feedback-hint"
        />
        <span id="feedback-hint" className="ct-metric-caption mt-2 block">
          Capture what changed, what feels off, and what should happen next.
        </span>
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className={BENTO_PRIMARY_BTN}
        >
          {isPending ? "Sending…" : "Log feedback"}
        </button>
      </div>
    </form>
  );
}
