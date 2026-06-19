"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createIcp, runSourcing } from "@/app/admin/outreach/actions";

/**
 * Inline "Define a distributor ICP" disclosure form. Creates an OutreachICP
 * (persona + Apollo filters) and, on success, immediately triggers a sourcing
 * run for it so the operator gets leads in one gesture.
 *
 * Sourcing is MOCK in Palier 0 (no Apollo credit spent) — the toast says so.
 * Nothing is sent; sourced leads land as `new` prospects, tiered by score.
 */
export function IcpForm() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        const { id } = await createIcp(formData);
        const result = await runSourcing(id);
        const { sourced, isMock, byTier } = result;
        toast.success(
          `${isMock ? "Demo sourcing" : "Sourced"}: ${sourced} lead${
            sourced === 1 ? "" : "s"
          } · A:${byTier.A} B:${byTier.B} C:${byTier.C}`,
          {
            description: isMock
              ? "Demo leads (Apollo not wired yet) — review before any send."
              : "Review tiers before any send.",
          },
        );
        setOpen(false);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Sourcing failed: ${message}`);
      }
    });
  }

  if (!open) {
    return (
      <Button variant="primary" size="md" onClick={() => setOpen(true)}>
        Define a distributor ICP
      </Button>
    );
  }

  return (
    <form
      action={onSubmit}
      className="admin-doc-inset admin-doc-stack admin-doc-stack--actions"
      aria-label="Define an ideal customer profile"
    >
      <div className="admin-doc-stack admin-doc-stack--tight">
        <p className="eyebrow">Ideal Customer Profile — distributor</p>
        <div className="admin-doc-form-grid-2">
          <label className="admin-doc-field" htmlFor="icp-name">
            <span className="stat-label">Name</span>
            <input
              id="icp-name"
              name="name"
              type="text"
              required
              placeholder="US RIAs & family offices"
              className="ct-input"
              autoFocus
            />
          </label>
          <label className="admin-doc-field" htmlFor="icp-language">
            <span className="stat-label">Email language</span>
            <select
              id="icp-language"
              name="language"
              defaultValue="en"
              className="ct-input"
              aria-label="Email language"
            >
              <option value="en">English</option>
              <option value="fr">French</option>
            </select>
          </label>
        </div>
        <label className="admin-doc-field" htmlFor="icp-titles">
          <span className="stat-label">
            Target titles (comma separated)
          </span>
          <input
            id="icp-titles"
            name="titles"
            type="text"
            placeholder="wealth manager, family office, RIA, IFA"
            className="ct-input"
          />
        </label>
        <div className="admin-doc-form-grid-2">
          <label className="admin-doc-field" htmlFor="icp-locations">
            <span className="stat-label">Locations</span>
            <input
              id="icp-locations"
              name="locations"
              type="text"
              placeholder="United States, Switzerland, United Kingdom"
              className="ct-input"
            />
          </label>
          <label className="admin-doc-field" htmlFor="icp-industries">
            <span className="stat-label">Industries / keywords</span>
            <input
              id="icp-industries"
              name="industries"
              type="text"
              placeholder="wealth management, financial services"
              className="ct-input"
            />
          </label>
        </div>
        <input type="hidden" name="persona" value="distributor" />
        <p className="body-xs ct-text-muted m-0">
          Tier thresholds default to 85 / 60 / 40 (Prime / Warm / Cold). Sourcing
          finds, scores, and tiers leads — it never sends.
        </p>
      </div>
      <div className="admin-form-actions">
        <Button type="submit" variant="primary" size="md" disabled={isPending}>
          {isPending ? "Sourcing…" : "Create & source leads"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={() => setOpen(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
