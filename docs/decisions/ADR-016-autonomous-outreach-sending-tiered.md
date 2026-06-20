# ADR-016 — Autonomous outreach sending, tiered

**Status**: Accepted
**Date**: 2026-06-20
**Deciders**: Founder (Adrien) + Eng
**Relates to**: ADR-011 (single LLM provider — OpenAI GPT-4.1), ADR-012 (chat is
read-only, human-in-the-loop), CLAUDE.md non-negotiable #4

## Context

The Outreach engine (lead-gen) sources distributor prospects from Apollo, scores
each with GPT-4.1, and routes the score into an **autonomy tier** (`tier.ts`):

- **Tier A "Prime"** — agent drafts only; the human rewrites & sends.
- **Tier B "Warm"** — agent sends the first touch; the human owns replies.
- **Tier C "Cold"** — closed loop: agent sends, follows up, reads, qualifies.

Through Paliers 0–2 and the "safe half" of Palier 3, the engine ran in
**SUGGEST** mode only: it drafts and tracks, but **a human approves every send**
(the `sendCampaign` Server Action flips emails to `sending` and an Inngest
fan-out delivers only `approved` rows). That is consistent with CLAUDE.md #4's
spirit ("no AI chat *with write/execute tools*"): nothing left the building
without a human in the loop.

Activating Tier B/C **autonomous sending** — where the agent sends a cold email
(and, in Palier 4, follow-ups) **without a per-email human approval** — crosses
that line. It is a write action (an email to a real third party, with our domain
reputation and CAN-SPAM/GDPR exposure attached) taken by software on its own.
That requires an explicit, recorded decision and its own guardrails. This ADR is
that decision.

## Decision

**Hearst allows tiered autonomous outreach sending as a SCOPED, gated, fully
auditable capability**, governed by a single server-side autonomy level and a
daily volume ceiling. It is **OFF by default**.

### 1. One autonomy dial, server-side, off by default

`OUTREACH_AUTONOMY` (env, validated in `src/lib/env.ts`, default `SUGGEST`):

| Level     | Tier A          | Tier B               | Tier C                          |
|-----------|-----------------|----------------------|---------------------------------|
| `SUGGEST` | draft only      | draft only           | draft only                      |
| `SEND`    | draft + alert   | **auto first touch** | **auto first touch**            |
| `NURTURE` | draft + alert   | auto first touch     | auto first touch **+ follow-ups** |
| `CLOSED`  | draft + alert   | auto first touch     | first touch + follow-ups **+ reply-driven qualify** |

- **Tier A is NEVER auto-sent at any level.** Prime leads are too valuable to
  spend on an unreviewed template — the agent drafts and raises a "Prime to
  review" alert; the human always sends.
- `SUGGEST` is the default and the safe posture: the engine is live (sources,
  scores, drafts, tracks) but **nothing auto-sends** — a human approves every
  send via the existing `sendCampaign` path.
- The level is read **server-side only**; there is no client override and no
  way to escalate autonomy from the browser.

### 2. Hard volume governor (deliverability + cost)

- `OUTREACH_DAILY_SEND_CAP` (env, default conservative) caps **auto-sends per
  UTC day**. The auto-send job counts today's already-sent rows and never
  exceeds the cap, regardless of how many leads are queued.
- A **warm-up curve** ramps the effective cap from a low floor so a cold sending
  domain is not blasted on day one (reputation protection).
- The send queue is **priority-ordered Prime > Warm > Cold** for follow-ups and
  fairness, but Prime is alert-only for first touch (see #1).

### 3. Every guardrail from the safe half still holds

- **Suppression is re-checked at send time** (`isSuppressed`, both the campaign
  fan-out and any auto path). An opt-out after drafting **blocks the send** — the
  row is marked, not delivered (unchanged from the shipped Palier 3 safe half).
- **Every auto-generated email is forbidden-words guarded** (`assertNoForbiddenWords`)
  and carries a working one-click **unsubscribe** link (`buildUnsubscribeUrl`,
  signed token). No change to the compliance posture; only *who clicks send*.
- **Full audit trail**: each auto-send writes an `adminAudit` row and stamps the
  email with the tier + autonomy level at send time (`tierAtSend`), so any
  delivered message is traceable to the policy that authorised it.

### 4. Reply-driven actions (Palier 4) stay bounded

- The reply-handler (`outreach-reply-handler.ts`) **classifies** an inbound reply
  (interested / not-now / unsubscribe / bounce / question) and may **promote a
  tier**, **stop a sequence**, or mark a prospect **qualified** — these are
  internal state changes, not outbound actions.
- The only outbound consequence the handler can trigger is **another tiered
  send**, which is itself subject to this same autonomy dial + cap. It cannot
  invent a new channel, cannot send to a suppressed address, and never touches
  anything financial/custodial.
- An `unsubscribe` classification **always** suppresses, regardless of autonomy
  level.

### Status of non-negotiable #4

CLAUDE.md #4 already carries a scoped chat exception (ADR-012). It is **further
amended here**: the four structured agents and the cockpit chat are unchanged;
the new exception is that **outreach sending may be agent-driven for Tier B/C
when `OUTREACH_AUTONOMY` is explicitly raised**, under the gate + cap + audit
above. This is *not* a financial/custodial action and remains off by default.
The orchestrator updates CLAUDE.md #4 to reference this ADR.

## Consequences

### Positive
- The engine can actually run as designed (the whole point of the tier model) —
  cold first touches go out without a human babysitting each one, while Prime
  leads stay in human hands.
- The autonomy dial makes the posture **explicit and reversible**: drop it back
  to `suggest` and every send is human again, instantly, with no code change.
- Deliverability and cost are bounded by a hard daily cap + warm-up, not by hope.

### Negative / risks
- **Autonomous sending is intrinsically higher-risk** than human-approved sends:
  a bad template or a mis-tuned ICP could send unwanted email at scale. Mitigated
  by the cap, warm-up, Tier-A-never-auto rule, forbidden-words guard, and the
  always-present unsubscribe — but this is the surface to watch.
- **Domain reputation** is now partly in software's hands. The warm-up curve and
  the conservative default cap exist precisely to protect it; raising the cap is
  a deliberate, reviewed step.
- **Autonomy creep is the failure mode.** Auto-sending Tier A, removing the cap,
  or adding a non-email outbound channel breaks the invariants here and requires
  a new ADR.

## Non-decisions (out of scope)
- **No autonomous Tier A sending** — explicitly rejected.
- **No new outbound channel** (SMS, LinkedIn automation, calling) — email only.
- **No financial/custodial/admin action** ever reachable from the outreach path.
- **Multi-domain sending** (to exceed ~500/day) is a separate, later decision
  (buy `go-hearst.com`, warm it up) — flagged, not enabled here.

## References
- Dial + cap: `OUTREACH_AUTONOMY`, `OUTREACH_DAILY_SEND_CAP` (`src/lib/env.ts`).
- Policy (pure): `src/lib/outreach/send-policy.ts`.
- Auto-send job: `src/lib/inngest/functions/outreach-auto-send.ts`.
- Follow-up cadence: `src/lib/inngest/functions/outreach-followups.ts`.
- Reply handler: `src/lib/agents/outreach-reply-handler.ts`,
  route `src/app/api/outreach/inbound/route.ts`.
- Tier model: `src/lib/outreach/tier.ts`. Suppression: `src/lib/outreach/suppression.ts`.
- Unsubscribe: `src/lib/outreach/unsubscribe.ts`. Plan: `docs/plan/outreach-engine.md`.
