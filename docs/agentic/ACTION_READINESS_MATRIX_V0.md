# Action Readiness Matrix v0

**Status**: shipped — read-only backend module, no UI yet  
**Module**: `src/lib/agentic/action-readiness/`  
**Tests**: `src/lib/agentic/action-readiness/__tests__/action-readiness.test.ts`

---

## Purpose

The Action Readiness Matrix is the single source of truth for what the platform's agents and
the cockpit chat can and cannot do. For every action it answers:

- What tier is it? (`read_only` / `draft_or_proposal` / `confirmed_write` / `forbidden_autonomous`)
- Is it autonomous?
- What human gate is required?
- What is the risk level?
- Why is it blocked or allowed?
- What are concrete examples?

This matrix is consumed by the visual console (future integration) and can be queried by any
read-only surface. It does **not** execute anything — it is a classification record only.

---

## Tiers

### `read_only`
- No DB write, no external effect.
- `autonomousAllowed: true` — safe for autonomous agent execution.
- No human gate required.
- Examples: navigation, product explanation, yield explanation, observability reads.

### `draft_or_proposal`
- Creates a stored draft with **no publish/send effect at creation time**.
- `autonomousAllowed: false` — potential DB write or external effect on confirm.
- Human gate required: two-step HITL confirmation token via `/api/admin/chat-tools`.
- Examples: vault draft, governance proposal draft, campaign draft, outreach email draft.

### `confirmed_write`
- Only one action: `outreach_trigger_send_run`.
- `autonomousAllowed: false` — always.
- `humanGateRequired: true` + `confirmationRequired: true` — always.
- Additional gates: `OUTREACH_AUTONOMY=SEND+`, daily cap, suppression re-check, forbidden-words guard, unsubscribe link, audit trail.
- Tier A is **unconditionally blocked** regardless of autonomy flags.

### `forbidden_autonomous`
- Hard-blocked. No chat agent, no agentic runtime, no automated path can reach these.
- `autonomousAllowed: false` — unconditional.
- Human gate: manual admin/operator action only, out-of-band.
- Examples: deploy to production, markAsLive, Safe/multisig signature, governance execution, DB migration, formula/model change, Tier A auto-send.

---

## Gates

| Gate | Used by | Description |
|---|---|---|
| two-step HITL token | draft_or_proposal, confirmed_write | Single-use input-bound token via `/api/admin/chat-tools`. Expires after one use. |
| OUTREACH_AUTONOMY=SEND+ | confirmed_write (send run) | Environment flag; default=`SUGGEST` (no-op). Must be explicitly set to enable. |
| OUTREACH_DAILY_SEND_CAP | confirmed_write (send run) | Hard daily ceiling enforced at send time. |
| requireAdmin | forbidden (all paths) | Server action gate; session must hold admin role. |
| blueprint completeness | vault operations | Vault must pass completeness check before state transitions. |
| approval quorum | markAsLive | Multi-step state machine (draft→review→deployed→live) + quorum. |
| Spearbit audit gate | deploy_product (smart contracts) | Mainnet deploy gated on completed audit + remediation (ADR-006). |
| governance quorum + timelock | governance_execution | On-chain or operational: quorum + timelock + explicit multi-step confirmation. |
| DBA + Prisma migrate | db_migration | Manual operator approval required; verified rollback plan. |
| Methodology version bump | formula_model_change | Version bump + ADR required before any engine change. |

---

## Forbidden autonomous actions

These 8 actions are **unconditionally blocked** regardless of environment, flags, or agent state:

1. `source_leads_autonomously` — PII collection, compliance risk
2. `deploy_product` — production deploy is git-push-triggered only; smart contracts gated on audit
3. `mark_vault_live` — dedicated admin server action with multi-step state machine
4. `safe_signature` — custodial financial action, no agent has signing key access
5. `governance_execution` — requires quorum, timelock, multi-step admin confirmation
6. `db_migration` — schema changes require explicit DBA approval and rollback plan
7. `formula_model_change` — engine is pure; changes require Methodology bump + ADR
8. `tier_a_auto_send` — Tier A is NEVER auto-sent, hard rule ADR-016

---

## Classification rules

1. **read_only** → may be autonomous IF no write, no external effect, no DB mutation.
2. **draft_or_proposal** → never autonomous (potential DB write or external effect on confirm).
3. **confirmed_write** → never autonomous; gate is always required.
4. **forbidden_autonomous** → never autonomous; no runtime path exists.
5. **Unknown write-like action** → defaults to `forbidden_autonomous` (fail-safe). See `classifyUnknownAction()`.
6. **Unknown non-write action** → defaults to `read_only / planned` until explicitly classified.

---

## How to add an action

1. Add an `ActionReadinessItem` entry to `src/lib/agentic/action-readiness/actions.ts`.
2. Assign the correct tier, status, autonomy flags, risk level, gate, reason, and examples.
3. Run `validateItem()` — it will throw if the entry violates consistency rules.
4. Add the new id to the expected list in the test file.
5. Update counts in the test file if the tier distribution changes.
6. Run `pnpm test -- src/lib/agentic/action-readiness` to verify.
7. If the action is a new confirmed-write or forbidden action, add an ADR or update an existing one.

---

## Safety guarantees

- This module contains **no I/O** — no DB, no fetch, no external calls.
- `buildActionReadinessMatrix()` is a **pure function**: same input → same output.
- `generatedAt` is caller-supplied to maintain purity (no `Date.now()` inside).
- All items pass `validateItem()` at build time — the builder throws if any item violates rules.
- No forbidden or confirmed-write item can be marked `autonomousAllowed: true` without a test failure.

---

## No tool execution

This module is a classification record only. It does not:
- Call any tool
- Execute any action
- Trigger any outreach
- Write any DB record
- Change any router/guard/HITL/chat behavior

It is safe to consume from any read-only server component.

---

## Future: visual console integration

This matrix is designed to be consumed by the Action Readiness Matrix visual section
in `/admin/agentic`. The integration will:
- Call `buildActionReadinessMatrix(new Date().toISOString())` server-side
- Display tier counts, per-action table, forbidden list, gates, and safety notes
- Add no write controls

The integration is **not in this lot** (v0 = backend/read-only module only).

---

## Related

- `docs/agentic/AGENTIC_CONTROL_CENTER_V0.md` — control center overview
- `src/lib/agentic/tool-boundary/` — tool boundary v1 (11 read + 7 write tool ids)
- `src/lib/agentic/reporting/` — reporting crew v0
- ADR-006 — smart contract phased rollout + mainnet gate
- ADR-012 — no autonomous write from chat
- ADR-016 — outreach autonomy levels + Tier A hard block
- ADR-017 — single chat engine (CHAT_MASTER_AGENT)
