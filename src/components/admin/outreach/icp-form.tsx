"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/catalyst/modal";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { TextField } from "@/components/catalyst/field";
import { Select } from "@/components/catalyst/select";
import {
  BENTO_FIELD,
  BENTO_FIELD_LABEL,
  BENTO_INPUT,
} from "@/components/admin/outreach/bento-form";
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

  return (
    <>
      <CockpitButton
        type="button"
        variant="primary"
        shape="rect"
        size="lg"
        onClick={() => setOpen(true)}
      >
        Define a distributor ICP
      </CockpitButton>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Ideal Customer Profile — distributor"
        className="max-w-2xl"
      >
        <form
          action={onSubmit}
          className="flex flex-col gap-4"
          aria-label="Define an ideal customer profile"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className={BENTO_FIELD} htmlFor="icp-name">
              <span className={BENTO_FIELD_LABEL}>Name</span>
              <TextField
                id="icp-name"
                name="name"
                type="text"
                required
                placeholder="US RIAs & family offices"
                className={BENTO_INPUT}
                autoFocus
              />
            </label>
            <label className={BENTO_FIELD} htmlFor="icp-language">
              <span className={BENTO_FIELD_LABEL}>Email language</span>
              <Select
                id="icp-language"
                name="language"
                defaultValue="en"
                className={BENTO_INPUT}
                aria-label="Email language"
              >
                <option value="en">English</option>
                <option value="fr">French</option>
              </Select>
            </label>
          </div>
          <label className={BENTO_FIELD} htmlFor="icp-titles">
            <span className={BENTO_FIELD_LABEL}>
              Target titles (comma separated)
            </span>
            <TextField
              id="icp-titles"
              name="titles"
              type="text"
              placeholder="wealth manager, family office, RIA, IFA"
              className={BENTO_INPUT}
            />
          </label>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className={BENTO_FIELD} htmlFor="icp-locations">
              <span className={BENTO_FIELD_LABEL}>Locations</span>
              <TextField
                id="icp-locations"
                name="locations"
                type="text"
                placeholder="United States, Switzerland, United Kingdom"
                className={BENTO_INPUT}
              />
            </label>
            <label className={BENTO_FIELD} htmlFor="icp-industries">
              <span className={BENTO_FIELD_LABEL}>Industries / keywords</span>
              <TextField
                id="icp-industries"
                name="industries"
                type="text"
                placeholder="wealth management, financial services"
                className={BENTO_INPUT}
              />
            </label>
          </div>
          <input type="hidden" name="persona" value="distributor" />
          <p className="ct-metric-caption m-0">
            Tier thresholds default to 85 / 60 / 40 (Prime / Warm / Cold). Sourcing
            finds, scores, and tiers leads — it never sends.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <CockpitButton
              type="submit"
              variant="primary"
              shape="rect"
              size="lg"
              disabled={isPending}
            >
              {isPending ? "Sourcing…" : "Create & source leads"}
            </CockpitButton>
            <CockpitButton
              type="button"
              variant="secondary"
              shape="rect"
              size="lg"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </CockpitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
