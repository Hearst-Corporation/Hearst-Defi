"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createCampaign } from "@/app/admin/outreach/actions";

/**
 * Inline "new campaign" disclosure form. Creates a draft OutreachCampaign with a
 * name, kind (cold | newsletter), and an optional base brief handed to the agent
 * when it drafts the per-recipient emails. createCampaign redirects to the new
 * campaign's detail page on success; toast only fires on error.
 */
export function CampaignForm() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await createCampaign(formData);
        // Success redirects to the new campaign's detail page.
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Create failed: ${message}`);
      }
    });
  }

  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        New campaign
      </Button>
    );
  }

  return (
    <form
      action={onSubmit}
      className="admin-doc-inset admin-doc-stack admin-doc-stack--actions"
      aria-label="Create campaign"
    >
      <div className="admin-doc-stack admin-doc-stack--tight">
        <p className="eyebrow">New campaign</p>
        <div className="admin-doc-form-grid-2">
          <label className="admin-doc-field" htmlFor="campaign-name">
            <span className="stat-label">Name</span>
            <input
              id="campaign-name"
              name="name"
              type="text"
              required
              placeholder="Q3 institutional cold outreach"
              className="ct-input"
              autoFocus
            />
          </label>
          <label className="admin-doc-field" htmlFor="campaign-kind">
            <span className="stat-label">Kind</span>
            <select
              id="campaign-kind"
              name="kind"
              defaultValue="cold"
              className="ct-input"
              aria-label="Campaign kind"
            >
              <option value="cold">Cold outreach</option>
              <option value="newsletter">Newsletter</option>
            </select>
          </label>
        </div>
        <label className="admin-doc-field" htmlFor="campaign-subject">
          <span className="stat-label">Subject template (optional)</span>
          <input
            id="campaign-subject"
            name="subjectTemplate"
            type="text"
            placeholder="A single-vault yield structure for {{company}}"
            className="ct-input"
          />
        </label>
        <label className="admin-doc-field" htmlFor="campaign-body">
          <span className="stat-label">
            Base brief for the agent (optional)
          </span>
          <textarea
            id="campaign-body"
            name="bodyTemplate"
            rows={5}
            placeholder="Introduce the Hearst Yield Vault: mining-backed structured yield, monthly USDC distributions, target APY range, Cayman SPV. Muted, institutional register."
            className="ct-input"
          />
        </label>
        <label className="admin-doc-inline-row admin-doc-inline-row--tight body-xs ct-text-muted">
          <input
            type="checkbox"
            name="includeTypeform"
            value="1"
            defaultChecked
            className="size-4 accent-(--ct-accent)"
          />
          <span>Personalise from Typeform qualification when available</span>
        </label>
      </div>
      <div className="admin-form-actions">
        <Button type="submit" variant="primary" size="md" disabled={isPending}>
          {isPending ? "Creating…" : "Create"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
