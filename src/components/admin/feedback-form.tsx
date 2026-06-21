"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { postFeedback } from "@/app/admin/feedback/actions";

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
    <form ref={formRef} action={onSubmit} className="admin-doc-stack admin-doc-stack--actions" aria-label="Feedback form">
      <div className="admin-doc-form-grid-2">
        <label className="block body-xs" htmlFor="feedback-itemId">
          <span className="ct-form-label">
            Related item (optional)
          </span>
          <input
            id="feedback-itemId"
            name="itemId"
            type="text"
            placeholder="e.g. dash-hero"
            className="ct-input mono"
          />
        </label>
        <label className="block body-xs" htmlFor="feedback-author">
          <span className="ct-form-label">
            Your name (optional)
          </span>
          <input
            id="feedback-author"
            name="author"
            type="text"
            placeholder="Adrien"
            className="ct-input"
          />
        </label>
      </div>

      <label className="block body-xs" htmlFor="feedback-pathname">
        <span className="ct-form-label">
          Page or context (optional)
        </span>
        <input
          id="feedback-pathname"
          name="pathname"
          type="text"
          placeholder="/admin/roadmap"
          className="ct-input mono"
        />
      </label>

      <label className="block body-xs" htmlFor="feedback-message">
        <span className="ct-form-label">
          Feedback
        </span>
        <textarea
          id="feedback-message"
          name="message"
          rows={4}
          required
          minLength={2}
          placeholder="What works? What doesn't? What's confusing?"
          className="ct-textarea"
          aria-describedby="feedback-hint"
        />
        <span id="feedback-hint" className="mt-[var(--ct-space-1)] block ct-text-muted">
          Capture what changed, what feels off, and what should happen next.
        </span>
      </label>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={isPending} size="sm" aria-busy={isPending}>
          {isPending ? "Sending…" : "Log feedback"}
        </Button>
      </div>
    </form>
  );
}
