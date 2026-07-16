"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";

import { CockpitButton } from "@/components/catalyst/cockpit-button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  TextField,
} from "@/components/catalyst/field";
import { Textarea } from "@/components/catalyst/textarea";
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
    <form
      ref={formRef}
      action={onSubmit}
      className="flex flex-col gap-y-5"
      aria-label="Feedback form"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="feedback-itemId">Related item (optional)</FieldLabel>
          <TextField
            id="feedback-itemId"
            name="itemId"
            type="text"
            placeholder="e.g. dash-hero"
            className="mono mt-2"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="feedback-author">Your name (optional)</FieldLabel>
          <TextField
            id="feedback-author"
            name="author"
            type="text"
            placeholder="Adrien"
            className="mt-2"
          />
        </Field>
      </FieldGroup>

      <Field>
        <FieldLabel htmlFor="feedback-pathname">Page or context (optional)</FieldLabel>
        <TextField
          id="feedback-pathname"
          name="pathname"
          type="text"
          placeholder="/admin/roadmap"
          className="mono mt-2"
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="feedback-message">Feedback</FieldLabel>
        <Textarea
          id="feedback-message"
          name="message"
          rows={4}
          required
          minLength={2}
          placeholder="What works? What doesn't? What's confusing?"
          className="mt-2"
          aria-describedby="feedback-hint"
        />
        <FieldDescription id="feedback-hint" className="mt-2">
          Capture what changed, what feels off, and what should happen next.
        </FieldDescription>
      </Field>

      <div className="flex justify-end">
        <CockpitButton
          type="submit"
          variant="primary"
          shape="rect"
          size="lg"
          disabled={isPending}
          aria-busy={isPending}
        >
          {isPending ? "Sending…" : "Log feedback"}
        </CockpitButton>
      </div>
    </form>
  );
}
