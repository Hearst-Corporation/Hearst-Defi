# BATCHES.md — Recovery Series Status

| Batch | Role | Statut | PR | Mergé |
|---|---|---|---|---|
| 1 | Intake — inventaire état réel | ✅ MERGÉ | PR #361 | Oui — commit `5d933f8b` |
| 2 | Truth Audit (données mockées, hardcodes, actions non branchées) | ✅ FAIT (2026-07-03) — mergé via commit `4d236c8d` (PR #363) | #363 | Oui — commit `4d236c8d` |
| 2b | Data Truth — anti-mock guard (couche données/API) | ✅ FAIT (2026-07-03, commit `b3487a69`/PR #369) ; **3 nouveaux fix 2026-07-04** (batch série 5/9) — T-13 : `uptime_pct` badgé "attested" alors que c'est un placeholder codé en dur (`market-data-hourly.ts`) → corrigé à `"estimated"` dans `loaders/mining.ts` + guard POINT 7. T-14 (2e invocation, même jour) : le même placeholder (+ `deployedHashrate`) était ENCORE badgé "attested" dans l'Investor Memo **PDF** (`pdf/memo-pages/mining-health.tsx`, consommateur distinct de T-13, document LP-visible) → corrigé + guard POINT 8. T-15 (3e invocation, même jour) : le même document (Investor Memo PDF) badgeait AUM/APY/risk score "attested" à partir de la SEULE fraîcheur du `VaultSnapshot`, sans jamais vérifier `source` — pouvait badger une ligne `"daily-seed"`/`"computed"` (seed synthétique) comme attestée → corrigé dans `loaders/vault.ts` via `isLiveTimelineSource()` (déjà utilisé côté dashboard) + guard POINT 9. **Intégré depuis** (vérifié batch 8/9 intégrateur, 2026-07-03) : les 3 fixes T-13/T-14/T-15 sont mergés dans `main` via PR #373, commit `e7a88f00` — `opsProvenance`/`isLiveTimelineSource`/POINT 7-8-9 confirmés présents sur `origin/main` HEAD. | #369, #373 | Oui — commits `b3487a69` et `e7a88f00` |
| 2c | Stabilization — typecheck/test verts, dette TS bloquante | ✅ FAIT (2026-07-03) — mergé via commit `9b01f8b3` (PR #370) ; re-confirmé 3x le 2026-07-03 (batch série 4/9 : checkout vierge, checkout chaud, checkout chaud) — aucun changement de code additionnel à chaque fois | #370 | Oui — commit `9b01f8b3` |
| 3 | Corrections P0 restantes (C-11, C-13 — C-05 réduit, voir 2b) | ⏳ En attente | — | — |
| 4 | Corrections P1 sécurité (C-09, C-14, NavSparkline) | ⏳ En attente | — | — |
| 5 | dev.db Alignment | ⏳ En attente (décision Adrien) | — | — |
| 6 | Décisions Produit Lot 4 (questions Adrien) | ⏳ En attente | — | — |
| 7 | Features non câblées Lot 5 (si feu vert) | ⏳ Différé | — | — |
| 8 | Notification Matrix + Bell (Lot 6) | ⏳ Différé | — | — |
| 9 | Lancement / Intégrations Tierces (D1-D7) | ⏳ Différé | — | — |

*Mis à jour : 2026-07-04 (batch 5/9 série — nouvelle invocation Data Truth, sweep étendu à
`src/lib/inngest/functions/*` : finding T-13 réel trouvé et corrigé (mining uptime provenance),
typecheck 0 erreur, test 448/448 fichiers 5354/5354 — PAS un no-op cette fois, voir `DECISIONS.md`
et `HANDOFF.md`. Re-confirmée le même jour par une invocation suivante sur la même branche :
diff T-13 relu et validé à nouveau (typecheck 0 erreur, test 448/448/5354/5354), sweep étendu à
`agentic/`, `outreach/`, `email/`, `power/` — aucun nouveau finding, no-op additionnel. **Nouvelle
invocation, même jour** : en poursuivant l'investigation de `loaders/mining.ts` vers son autre
consommateur (`loadMiningOpsSnapshot` → Investor Memo PDF), 2e finding réel trouvé et corrigé —
T-14 : le même placeholder mining (uptime + hashrate) était encore badgé "attested" dans le PDF
LP-visible (`pdf/memo-pages/mining-health.tsx`), non couvert par le fix T-13. typecheck 0 erreur,
test 448/448 fichiers 5355/5355 (POINT 8 ajouté). Voir `DECISIONS.md` §"2e fix réel". **Nouvelle
invocation, même jour** : en suivant le même fil vers un 3e consommateur
(`loaders/vault.ts::loadMemoInput`, même document Investor Memo PDF mais champs vault/mining
AUM-APY-risk), 3e finding réel trouvé et corrigé — T-15 : le tag de provenance ne regardait que la
fraîcheur du `VaultSnapshot`, jamais son `source` — pouvait badger un seed synthétique
(`"daily-seed"`/`"computed"`) comme "attested". Corrigé via `isLiveTimelineSource()` (garde déjà
utilisée côté dashboard, absente côté memo loader). typecheck 0 erreur, test 448/448 fichiers
5358/5358 (POINT 9 ajouté, 3 tests). Voir `DECISIONS.md` §"3e fix réel".)*
