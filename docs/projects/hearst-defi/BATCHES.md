# BATCHES.md — Recovery Series Status

| Batch | Role | Statut | PR | Mergé |
|---|---|---|---|---|
| 1 | Intake — inventaire état réel | ✅ MERGÉ | PR #361 | Oui — commit `5d933f8b` |
| 2 | Truth Audit (données mockées, hardcodes, actions non branchées) | ✅ FAIT (2026-07-03) | À créer | Non |
| 2b | Data Truth — anti-mock guard (couche données/API) | ✅ FAIT (2026-07-03) | À créer | Non |
| 2c | Stabilization — typecheck/test verts, dette TS bloquante | ✅ FAIT (2026-07-03) — mergé via commit `9b01f8b3` (PR #370) ; re-confirmé 3x le 2026-07-03 (batch série 4/9 : checkout vierge, checkout chaud, checkout chaud) — aucun changement de code additionnel à chaque fois | #370 | Oui — commit `9b01f8b3` |
| 3 | Corrections P0 restantes (C-11, C-13 — C-05 réduit, voir 2b) | ⏳ En attente | — | — |
| 4 | Corrections P1 sécurité (C-09, C-14, NavSparkline) | ⏳ En attente | — | — |
| 5 | dev.db Alignment | ⏳ En attente (décision Adrien) | — | — |
| 6 | Décisions Produit Lot 4 (questions Adrien) | ⏳ En attente | — | — |
| 7 | Features non câblées Lot 5 (si feu vert) | ⏳ Différé | — | — |
| 8 | Notification Matrix + Bell (Lot 6) | ⏳ Différé | — | — |
| 9 | Lancement / Intégrations Tierces (D1-D7) | ⏳ Différé | — | — |

*Mis à jour : 2026-07-03 (batch 4/9 série — 4e confirmation Stabilization, no-op)*
