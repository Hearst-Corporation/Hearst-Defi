/**
 * Outreach event catalog.
 *
 * String keys are the canonical Inngest event names. Keep them stable — they
 * are referenced both by the publisher (`inngest.send`) and the consumer
 * (`outreachSend` function trigger). Changing a value breaks the wire contract.
 */
export const OUTREACH_EVENTS = {
  CAMPAIGN_SEND: "outreach.campaign.send",
} as const;

/**
 * Payload for `outreach.campaign.send`.
 *
 * `campaignId` — the OutreachCampaign whose `approved` emails should be sent.
 * `requestedBy` — wallet/userId of the admin who triggered the send (audit trail).
 */
export interface OutreachCampaignSendPayload {
  campaignId: string;
  requestedBy: string;
}
