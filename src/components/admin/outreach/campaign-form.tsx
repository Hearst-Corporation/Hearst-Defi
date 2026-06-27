"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/ui/modal";
import {
  BENTO_PRIMARY_BTN,
  BENTO_SECONDARY_BTN,
} from "@/components/ui/bento";
import {
  BENTO_FIELD,
  BENTO_FIELD_LABEL,
  BENTO_INPUT,
} from "@/components/admin/outreach/bento-form";
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

  return (
    <>
      <button type="button" className={BENTO_PRIMARY_BTN} onClick={() => setOpen(true)}>
        New campaign
      </button>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="New campaign"
        className="max-w-2xl"
      >
        <form
          action={onSubmit}
          className="flex flex-col gap-4"
          aria-label="Create campaign"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className={BENTO_FIELD} htmlFor="campaign-name">
              <span className={BENTO_FIELD_LABEL}>Name</span>
              <input
                id="campaign-name"
                name="name"
                type="text"
                required
                placeholder="Q3 institutional cold outreach"
                className={BENTO_INPUT}
                autoFocus
              />
            </label>
            <label className={BENTO_FIELD} htmlFor="campaign-kind">
              <span className={BENTO_FIELD_LABEL}>Kind</span>
              <select
                id="campaign-kind"
                name="kind"
                defaultValue="cold"
                className={BENTO_INPUT}
                aria-label="Campaign kind"
              >
                <option value="cold">Cold outreach</option>
                <option value="newsletter">Newsletter</option>
              </select>
            </label>
          </div>
          <label className={BENTO_FIELD} htmlFor="campaign-subject">
            <span className={BENTO_FIELD_LABEL}>Subject template (optional)</span>
            <input
              id="campaign-subject"
              name="subjectTemplate"
              type="text"
              placeholder="A single-vault yield structure for {{company}}"
              className={BENTO_INPUT}
            />
          </label>
          <label className={BENTO_FIELD} htmlFor="campaign-body">
            <span className={BENTO_FIELD_LABEL}>
              Base brief for the agent (optional)
            </span>
            <textarea
              id="campaign-body"
              name="bodyTemplate"
              rows={5}
              placeholder="Introduce the Hearst Yield Vault: mining-backed structured yield, monthly USDC distributions, target APY range, Cayman SPV. Muted, institutional register."
              className={BENTO_INPUT}
            />
          </label>
          <label className="flex items-center gap-2 text-[12px] text-zinc-400">
            <input
              type="checkbox"
              name="includeTypeform"
              value="1"
              defaultChecked
              className="size-4 accent-[#A7FB90]"
            />
            <span>Personalise from Typeform qualification when available</span>
          </label>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="submit" className={BENTO_PRIMARY_BTN} disabled={isPending}>
              {isPending ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              className={BENTO_SECONDARY_BTN}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
