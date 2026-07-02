# PROJECT_PLAN — Hearst Connect Recovery Series

> Series: series_recovery_hearst-defi_0  
> Created: 2026-07-02 (bootstrapped by batch 2 auditor — batch 1 intake.recovery was not run)

## Goal

Systematic recovery audit of the Hearst Connect production codebase:
identify truth gaps (mocked data, stubs, hardcodes, unconnected actions),
surface structural risks, and produce a prioritized fix backlog.

## Scope

- Product: `src/app/(product)/`, `src/components/`, `src/lib/`
- Admin: `src/app/admin/`
- Engine: `src/lib/engine/`
- Agents: `src/lib/agents/`, `src/lib/llm/`
- APIs: `src/app/api/`
- Contracts: `contracts/` (Phase 2 testnet, Phase 3 audited vault)

## Out of scope

- Infrastructure / Vercel / GitHub Actions wiring
- External integrations (CoinGecko, Mempool.space) — already audited
- Design system tokens (covered by ds-* skills)

## Batches

| # | Role | Status | Owner zone |
|---|------|--------|------------|
| 1 | intake.recovery | SKIPPED (bootstrapped by batch 2) | docs/projects/hearst-defi/ |
| 2 | auditor (truth audit) | COMPLETE | docs/projects/hearst-defi/ (read-only on code) |
| 3–9 | TBD by Adrien | PENDING | TBD |

## Success criteria

- DECISIONS.md populated with all truth gaps, severity-ranked
- No production surface shows fake data without a provenance badge
- All HIGH-severity hardcodes resolved before next production deploy
