import "server-only";

import { prisma } from "@/lib/db";
import { clampPageSize, toPrismaSkip } from "@/lib/pagination";

// ---------------------------------------------------------------------------
// Outreach supervision contract.
//
// Server-only Prisma loaders + aggregate stats for the outreach admin
// (prospects, campaigns, per-campaign email funnels). Every Date stays a Date
// and every count is a plain number — no Prisma scalar leaks past this
// boundary (mirrors the pattern in `src/lib/data/customers.ts`).
//
// Status vocabularies (kept in sync with prisma/schema.prisma):
//   OutreachProspect.status : new | contacted | opened | replied | qualified
//                             | converted | opted_out | bounced
//   OutreachEmail.status    : draft | approved | sent | delivered | opened
//                             | clicked | bounced | failed
//   OutreachEmailEvent.type : delivered | opened | clicked | bounced
//                             | complained
// ---------------------------------------------------------------------------

/** Funnel statuses that count as "the email left the building". */
const SENT_LIKE_STATUSES = ["sent", "delivered", "opened", "clicked"] as const;
/** Funnel statuses that imply Resend confirmed delivery. */
const DELIVERED_LIKE_STATUSES = ["delivered", "opened", "clicked"] as const;
/** Funnel statuses that imply at least one open. */
const OPENED_LIKE_STATUSES = ["opened", "clicked"] as const;

// ---------------------------------------------------------------------------
// Prospects
// ---------------------------------------------------------------------------

export interface OutreachProspectRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  title: string | null;
  source: string;
  status: string;
  hubspotContactId: string | null;
  /** Lead-gen engine fields (null for manually-added prospects). */
  tier: string | null;
  qualScore: number | null;
  /** Total emails ever queued/sent to this prospect across all campaigns. */
  emailCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProspectsPage {
  rows: OutreachProspectRow[];
  total: number;
  hasMore: boolean;
}

/**
 * Paginated prospect list for the admin table. Optional `status` filter is
 * applied to BOTH the page query and the count so the header total matches the
 * rendered population. Never throws on empty data.
 */
export async function loadProspects(opts?: {
  page?: number;
  pageSize?: number;
  status?: string;
}): Promise<ProspectsPage> {
  const page = Math.max(opts?.page ?? 1, 1);
  const pageSize = clampPageSize(opts?.pageSize ?? 50);
  const status = opts?.status?.trim();

  const where = status ? { status } : {};

  const [prospects, total] = await Promise.all([
    prisma.outreachProspect.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: toPrismaSkip(page, pageSize),
      take: pageSize,
      include: { _count: { select: { emails: true } } },
    }),
    prisma.outreachProspect.count({ where }),
  ]);

  const rows: OutreachProspectRow[] = prospects.map((p) => ({
    id: p.id,
    email: p.email,
    firstName: p.firstName,
    lastName: p.lastName,
    company: p.company,
    title: p.title,
    source: p.source,
    status: p.status,
    hubspotContactId: p.hubspotContactId,
    tier: p.tier,
    qualScore: p.qualScore,
    emailCount: p._count.emails,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));

  return { rows, total, hasMore: page * pageSize < total };
}

// ---------------------------------------------------------------------------
// ICP (Ideal Customer Profile)
// ---------------------------------------------------------------------------

export interface IcpRow {
  id: string;
  name: string;
  persona: string;
  language: string;
  active: boolean;
  /**
   * Parsed filter summaries for display (titles / locations / industries).
   * `[]` = nothing recorded; `null` = the stored JSON is unreadable — the
   * value is UNAVAILABLE and must be rendered as such, never as an empty list.
   */
  titles: string[] | null;
  locations: string[] | null;
  industries: string[] | null;
  tierAMin: number;
  tierBMin: number;
  tierCMin: number;
  /** How many prospects have been sourced for this ICP so far. */
  prospectCount: number;
  createdAt: Date;
}

/**
 * Parse a JSON string-array column. An absent column (`null`/empty) is an
 * honest [] — nothing was ever recorded. Malformed or non-array JSON returns
 * `null`: the stored value exists but is unreadable, and coercing corruption
 * to an empty list would fabricate data (admin honesty gate, rule c3).
 */
function parseStringList(raw: string | null): string[] | null {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string")
      : null;
  } catch {
    return null;
  }
}

/**
 * All ICPs (active first, then newest), each with parsed filter summaries and a
 * count of prospects sourced under it. Never throws on empty data.
 */
export async function loadIcps(): Promise<IcpRow[]> {
  const icps = await prisma.outreachICP.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
  });

  // One grouped count keyed by icpId rather than N per-ICP queries.
  const counts = await prisma.outreachProspect.groupBy({
    by: ["icpId"],
    _count: { _all: true },
  });
  const countByIcp = new Map<string, number>();
  for (const c of counts) {
    if (c.icpId) countByIcp.set(c.icpId, c._count._all);
  }

  return icps.map((icp) => ({
    id: icp.id,
    name: icp.name,
    persona: icp.persona,
    language: icp.language,
    active: icp.active,
    titles: parseStringList(icp.titles),
    locations: parseStringList(icp.locations),
    industries: parseStringList(icp.industries),
    tierAMin: icp.tierAMin,
    tierBMin: icp.tierBMin,
    tierCMin: icp.tierCMin,
    prospectCount: countByIcp.get(icp.id) ?? 0,
    createdAt: icp.createdAt,
  }));
}

// ---------------------------------------------------------------------------
// Campaigns (list)
// ---------------------------------------------------------------------------

/** Per-campaign email funnel counts derived from OutreachEmail.status. */
interface CampaignFunnelCounts {
  total: number;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
}

export interface CampaignRow extends CampaignFunnelCounts {
  id: string;
  name: string;
  kind: string;
  status: string;
  createdAt: Date;
}

/**
 * Builds funnel counts from a list of email statuses. `sent` counts every
 * email that left (sent/delivered/opened/clicked) so the headline stays
 * monotonic with the rest of the funnel.
 */
function tallyFunnel(statuses: readonly string[]): CampaignFunnelCounts {
  const counts: CampaignFunnelCounts = {
    total: statuses.length,
    sent: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
  };
  for (const s of statuses) {
    if ((SENT_LIKE_STATUSES as readonly string[]).includes(s)) counts.sent += 1;
    if ((OPENED_LIKE_STATUSES as readonly string[]).includes(s)) counts.opened += 1;
    if (s === "clicked") counts.clicked += 1;
    if (s === "bounced") counts.bounced += 1;
  }
  return counts;
}

/**
 * All campaigns (newest first) with their email funnel counts. Uses a single
 * `groupBy` over OutreachEmail keyed by (campaignId, status) so the funnel is
 * one round-trip regardless of campaign count.
 */
export async function loadCampaigns(): Promise<CampaignRow[]> {
  const [campaigns, grouped] = await Promise.all([
    prisma.outreachCampaign.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.outreachEmail.groupBy({
      by: ["campaignId", "status"],
      _count: { _all: true },
    }),
  ]);

  // campaignId -> repeated status list (one entry per email), fed to tallyFunnel.
  const statusesByCampaign = new Map<string, string[]>();
  for (const g of grouped) {
    const list = statusesByCampaign.get(g.campaignId) ?? [];
    for (let i = 0; i < g._count._all; i += 1) list.push(g.status);
    statusesByCampaign.set(g.campaignId, list);
  }

  return campaigns.map((c) => {
    const funnel = tallyFunnel(statusesByCampaign.get(c.id) ?? []);
    return {
      id: c.id,
      name: c.name,
      kind: c.kind,
      status: c.status,
      createdAt: c.createdAt,
      ...funnel,
    };
  });
}

// ---------------------------------------------------------------------------
// Campaign detail
// ---------------------------------------------------------------------------

export interface CampaignEmailRow {
  id: string;
  toEmail: string;
  subject: string;
  body: string;
  status: string;
  draftedByAgent: boolean;
  resendEmailId: string | null;
  /** Most recent OutreachEmailEvent.type for this email, or null. */
  latestEventType: string | null;
  /** When that latest event occurred, or null when no events. */
  latestEventAt: Date | null;
  approvedAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignDetail {
  id: string;
  name: string;
  kind: string;
  status: string;
  fromEmail: string | null;
  subjectTemplate: string | null;
  bodyTemplate: string | null;
  includeTypeform: boolean;
  createdAt: Date;
  sentAt: Date | null;
  emails: CampaignEmailRow[];
  /** Count of emails per OutreachEmail.status within this campaign. */
  statusCounts: Record<string, number>;
}

/**
 * Single campaign with its emails (newest first), each annotated with its
 * latest event status, plus per-status counts and a funnel rollup. Returns
 * `null` when the campaign id does not exist.
 */
export async function loadCampaignDetail(
  id: string,
): Promise<CampaignDetail | null> {
  const campaign = await prisma.outreachCampaign.findUnique({
    where: { id },
    include: {
      emails: {
        orderBy: { createdAt: "desc" },
        include: {
          events: { orderBy: { occurredAt: "desc" }, take: 1 },
        },
      },
    },
  });

  if (!campaign) return null;

  const emails: CampaignEmailRow[] = campaign.emails.map((e) => {
    const latest = e.events[0] ?? null;
    return {
      id: e.id,
      toEmail: e.toEmail,
      subject: e.subject,
      body: e.body,
      status: e.status,
      draftedByAgent: e.draftedByAgent,
      resendEmailId: e.resendEmailId,
      latestEventType: latest?.type ?? null,
      latestEventAt: latest?.occurredAt ?? null,
      approvedAt: e.approvedAt,
      sentAt: e.sentAt,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  });

  const statusCounts: Record<string, number> = {};
  for (const e of emails) {
    statusCounts[e.status] = (statusCounts[e.status] ?? 0) + 1;
  }

  return {
    id: campaign.id,
    name: campaign.name,
    kind: campaign.kind,
    status: campaign.status,
    fromEmail: campaign.fromEmail,
    subjectTemplate: campaign.subjectTemplate,
    bodyTemplate: campaign.bodyTemplate,
    includeTypeform: campaign.includeTypeform,
    createdAt: campaign.createdAt,
    sentAt: campaign.sentAt,
    emails,
    statusCounts,
  };
}

// ---------------------------------------------------------------------------
// Prospect detail — CRM sheet (identity + Apollo enrichment + engagement)
// ---------------------------------------------------------------------------

/** One outreach email sent/queued to this prospect, newest first. */
export interface ProspectEmailRow {
  id: string;
  campaignId: string;
  campaignName: string | null;
  subject: string;
  status: string;
  draftedByAgent: boolean;
  tierAtSend: string | null;
  sentAt: Date | null;
  createdAt: Date;
  latestEventType: string | null;
  latestEventAt: Date | null;
}

/** One inbound reply matched to this prospect. */
export interface ProspectReplyRow {
  id: string;
  fromEmail: string;
  subject: string | null;
  body: string;
  intent: string | null;
  confidence: number | null;
  actionTaken: string | null;
  handledAt: Date | null;
  createdAt: Date;
}

export interface ProspectDetail {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  title: string | null;
  source: string;
  status: string;
  /** `[]` = no tags recorded; `null` = tags column unreadable (unavailable). */
  tags: string[] | null;
  notes: string | null;
  hubspotContactId: string | null;
  // ── Apollo enrichment snapshot ──
  apolloId: string | null;
  linkedinUrl: string | null;
  companyDomain: string | null;
  industry: string | null;
  emailStatus: string | null;
  /** Parsed raw ApolloPerson JSON (flat key→value), or null when absent/invalid. */
  apolloData: Record<string, unknown> | null;
  // ── Scoring / lifecycle ──
  qualScore: number | null;
  tier: string | null;
  icpId: string | null;
  /** Name of the ICP this prospect was sourced for, or null. */
  icpName: string | null;
  sequenceStep: number;
  lastContactedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  emails: ProspectEmailRow[];
  replies: ProspectReplyRow[];
}

/**
 * Parse the tags JSON column. An absent column (`null`) is an honest [] — no
 * tags were ever recorded. Malformed or non-array JSON returns `null`: the
 * stored value exists but is unreadable, and coercing corruption to an empty
 * list would fabricate data (admin honesty gate, rule c3).
 */
function parseTags(raw: string | null): string[] | null {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((v): v is string => typeof v === "string" && v.length > 0);
  } catch {
    return null;
  }
}

/** Tolerant JSON-object parse for the raw Apollo snapshot. */
function parseApolloData(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Single prospect with everything the CRM sheet shows: identity, the Apollo
 * enrichment snapshot, scoring/tier, the ICP it was sourced for, and the full
 * engagement record (emails sent + inbound replies, newest first). Returns
 * `null` when the id does not exist. Never throws on empty relations.
 */
export async function loadProspectDetail(
  id: string,
): Promise<ProspectDetail | null> {
  const prospect = await prisma.outreachProspect.findUnique({
    where: { id },
    include: {
      emails: {
        orderBy: { createdAt: "desc" },
        include: {
          campaign: { select: { name: true } },
          events: { orderBy: { occurredAt: "desc" }, take: 1 },
        },
      },
      replies: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!prospect) return null;

  // The ICP link is a loose FK (no relation) — resolve its name if present.
  let icpName: string | null = null;
  if (prospect.icpId) {
    const icp = await prisma.outreachICP.findUnique({
      where: { id: prospect.icpId },
      select: { name: true },
    });
    icpName = icp?.name ?? null;
  }

  const emails: ProspectEmailRow[] = prospect.emails.map((e) => {
    const latest = e.events[0] ?? null;
    return {
      id: e.id,
      campaignId: e.campaignId,
      campaignName: e.campaign?.name ?? null,
      subject: e.subject,
      status: e.status,
      draftedByAgent: e.draftedByAgent,
      tierAtSend: e.tierAtSend,
      sentAt: e.sentAt,
      createdAt: e.createdAt,
      latestEventType: latest?.type ?? null,
      latestEventAt: latest?.occurredAt ?? null,
    };
  });

  const replies: ProspectReplyRow[] = prospect.replies.map((r) => ({
    id: r.id,
    fromEmail: r.fromEmail,
    subject: r.subject,
    body: r.body,
    intent: r.intent,
    confidence: r.confidence,
    actionTaken: r.actionTaken,
    handledAt: r.handledAt,
    createdAt: r.createdAt,
  }));

  return {
    id: prospect.id,
    email: prospect.email,
    firstName: prospect.firstName,
    lastName: prospect.lastName,
    company: prospect.company,
    title: prospect.title,
    source: prospect.source,
    status: prospect.status,
    tags: parseTags(prospect.tags),
    notes: prospect.notes,
    hubspotContactId: prospect.hubspotContactId,
    apolloId: prospect.apolloId,
    linkedinUrl: prospect.linkedinUrl,
    companyDomain: prospect.companyDomain,
    industry: prospect.industry,
    emailStatus: prospect.emailStatus,
    apolloData: parseApolloData(prospect.apolloData),
    qualScore: prospect.qualScore,
    tier: prospect.tier,
    icpId: prospect.icpId,
    icpName,
    sequenceStep: prospect.sequenceStep,
    lastContactedAt: prospect.lastContactedAt,
    createdAt: prospect.createdAt,
    updatedAt: prospect.updatedAt,
    emails,
    replies,
  };
}

// ---------------------------------------------------------------------------
// Global stats
// ---------------------------------------------------------------------------

export interface OutreachStats {
  /** Prospect head-count keyed by OutreachProspect.status. */
  prospectsByStatus: Record<string, number>;
  totalProspects: number;
  /** Email funnel totals across every campaign. */
  emails: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
  };
  /** Percentages (0–100, one decimal), divide-by-zero guarded to 0. */
  rates: {
    openRate: number;
    clickRate: number;
    bounceRate: number;
  };
}

/** Percentage of `part` over `whole`, one decimal, 0 when `whole` is 0. */
function rate(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/**
 * Global outreach KPIs: prospect distribution by status plus the email funnel
 * (sent / delivered / opened / clicked / bounced) with derived open/click/
 * bounce rates. Open & click rates are over delivered (so transient bounces
 * don't deflate them); bounce rate is over sent.
 */
export async function computeOutreachStats(): Promise<OutreachStats> {
  const [prospectGroups, emailGroups] = await Promise.all([
    prisma.outreachProspect.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.outreachEmail.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const prospectsByStatus: Record<string, number> = {};
  let totalProspects = 0;
  for (const g of prospectGroups) {
    prospectsByStatus[g.status] = g._count._all;
    totalProspects += g._count._all;
  }

  const countFor = (statuses: readonly string[]): number =>
    emailGroups
      .filter((g) => statuses.includes(g.status))
      .reduce((sum, g) => sum + g._count._all, 0);

  const sent = countFor(SENT_LIKE_STATUSES);
  const delivered = countFor(DELIVERED_LIKE_STATUSES);
  const opened = countFor(OPENED_LIKE_STATUSES);
  const clicked = countFor(["clicked"]);
  const bounced = countFor(["bounced"]);

  return {
    prospectsByStatus,
    totalProspects,
    emails: { sent, delivered, opened, clicked, bounced },
    rates: {
      openRate: rate(opened, delivered),
      clickRate: rate(clicked, delivered),
      bounceRate: rate(bounced, sent),
    },
  };
}
