# BATCHES.md — Recovery Series Status

| Batch | Role | Statut | PR | Mergé |
|---|---|---|---|---|
| 1 | Intake — inventaire état réel | ✅ MERGÉ | PR #361 | Oui — commit `5d933f8b` |
| 2 | Truth Audit (données mockées, hardcodes, actions non branchées) | ✅ FAIT (2026-07-03) — mergé via commit `4d236c8d` (PR #363) | #363 | Oui — commit `4d236c8d` |
| 2b | Data Truth — anti-mock guard (couche données/API) | ✅ FAIT (2026-07-03) — mergé via commit `b3487a69` (PR #369) ; re-confirmé le 2026-07-03 (batch série 5/9, checkout vierge) — balayage T-01→T-12 + diff `src/lib`/`src/app/api` depuis le merge, aucun nouveau mock non signalé, aucun changement de code additionnel | #369 | Oui — commit `b3487a69` |
| 2c | Stabilization — typecheck/test verts, dette TS bloquante | ✅ FAIT (2026-07-03) — mergé via commit `9b01f8b3` (PR #370) ; re-confirmé 3x le 2026-07-03 (batch série 4/9 : checkout vierge, checkout chaud, checkout chaud) — aucun changement de code additionnel à chaque fois | #370 | Oui — commit `9b01f8b3` |
| 3 | Corrections P0 restantes (C-11, C-13 — C-05 réduit, voir 2b) | ⏳ En attente | — | — |
| 4 | Corrections P1 sécurité (C-09, C-14, NavSparkline) | ⏳ En attente | — | — |
| 5 | dev.db Alignment | ⏳ En attente (décision Adrien) | — | — |
| 6 | Décisions Produit Lot 4 (questions Adrien) | ⏳ En attente | — | — |
| 7 | Features non câblées Lot 5 (si feu vert) | ⏳ Différé | — | — |
| 8 | Notification Matrix + Bell (Lot 6) | ⏳ Différé | — | — |
| 9 | Lancement / Intégrations Tierces (D1-D7) | ⏳ Différé | — | — |

*Mis à jour : 2026-07-03 (batch 5/9 série — nouvelle invocation Data Truth, sweep anti-mock étendu (governance/distribution/notifications/onchain/products/vault-drafts/agentic-swarm-live) + typecheck/tests ciblés verts, no-op)*
