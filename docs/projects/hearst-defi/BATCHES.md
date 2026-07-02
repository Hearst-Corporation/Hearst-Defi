# BATCHES — Hearst Connect Recovery Series

> Series: series_recovery_hearst-defi_0  
> Execution mode: sequential-manual (Adrien launches each loop)

| Batch | Role | dependsOn | Status | Notes |
|-------|------|-----------|--------|-------|
| 1 | intake.recovery | — | SKIPPED | Batch 2 bootstrapped the project structure |
| 2 | auditor | 1 | COMPLETE | Truth audit complete; DECISIONS.md populated |
| 3 | fixer (HIGH items) | 2 | PENDING | Fix testnet address fallback + APY PDF defaults |
| 4 | fixer (MEDIUM items) | 3 | PENDING | Fix Math.random/Date.now in agents; wire notification count |
| 5 | fixer (MEDIUM items continued) | 4 | PENDING | Mining engine placeholder + BTC tactical guardrail |
| 6 | wiring (UI gaps) | 5 | PENDING | Wire shortcuts panel; fix saved views; wire chart selector |
| 7 | ops (cron + IPFS) | 6 | PENDING | Trigger mining-health-daily; add IPFS pinning |
| 8 | validation | 7 | PENDING | typecheck + test + build + visual review |
| 9 | merge + deploy | 8 | PENDING | PR + merge to main — requires explicit Adrien confirmation |
