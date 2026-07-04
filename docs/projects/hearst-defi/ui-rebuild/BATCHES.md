# BATCHES.md — UI/UX Rebuild Series Status (`series_ui_hearst-defi_0`)

> Sous-dossier `ui-rebuild/` utilisé au lieu de `docs/projects/hearst-defi/{BATCHES,DECISIONS,HANDOFF}.md`
> — ces fichiers racine sont l'owner-zone active de la Recovery Series (série différente, non
> terminée, cf. `docs/agent-file-locks.md` + `PROJECT_PLAN.md` §"Pourquoi ce dossier est séparé").
> `executionMode: sequential-orchestrated` — un seul batch actif à la fois, aucun parallélisme.

| Batch | Rôle | Statut | Livrable |
|---|---|---|---|
| 1 | Intake — Current State | ✅ FAIT (2026-07-04) | `PROJECT_STATE.md` — inventaire 78 routes, verdict 4 axes |
| 2 | Planner — Information Architecture | ✅ FAIT (2026-07-04, ce batch) | `IA_TARGET.md` — IA cible (nav/hiérarchie), 7 décisions (D1-D7) |
| 3 | Implémentation — Canonisation panel headers (D4) | ✅ FAIT (2026-07-04) | Audit conclu : pas de doublon réel — `cockpit-panel-header.tsx` n'exportait que `AdminLeafLink` (un lien "View full →", pas un header). Renommé en `admin-leaf-link.tsx` pour lever l'ambiguïté de nom ; `dashboard-panel-header.tsx` (Catalyst) reste l'unique vrai header de section, inchangé sur le fond. Voir `DECISIONS.md` §Batch 3 |
| 4 | Implémentation — Registre nav complet (D5) | ⏳ Défini, non démarré | Ajouter 3 entrées `hideFromSubNav: true` dans `product-nav-items.ts` pour `diagnostics`, `btc-mining-performance-vault`, `agent-canvas` — zéro changement visuel |
| 5 | Implémentation — Politique data-viz `rgba()` (D6, conditionnel) | ⏳ Défini, conditionnel à arbitrage owner | Remplacer les `rgba()` inline (4 fichiers identifiés batch 1) par tokens `--ct-*` ou documenter l'exception. **Skip si l'owner juge le risque/gain insuffisant** — ne pas forcer |
| 6 | Audit — Discipline breakpoints | ⏳ Défini, non démarré | Vérifier les surfaces admin denses à plus fort trafic (dashboard, product-workspace, strategies) aux seuils `md:`/`sm:` — batch 1 a noté une concentration `lg:` (57%) sans anomalie détectée, ce batch confirme ou corrige au cas par cas |
| 7 | QA visuelle | ⏳ Défini, non démarré | Skill `visual-review` / Playwright sur routes représentatives (portfolio, vaults, proof-center, admin dashboard, admin strategy) à 3 breakpoints, après batches 3-6 |
| 8 | Intégrateur / clôture série | ⏳ Défini, non démarré | Récap statut mergé de tous les batches, décision sur fusion `ui-rebuild/` → racine `docs/projects/hearst-defi/` (une fois Recovery Series terminée), ADR si décision produit non-triviale a émergé |

## Notes de séquencement

- Batches 3 et 4 sont indépendants entre eux (fichiers disjoints : composants panel-header vs
  `product-nav-items.ts`) mais `executionMode: sequential-orchestrated` impose un seul batch actif
  à la fois — l'ordre 3→4 est arbitraire, pas une dépendance dure.
- Batch 5 est conditionnel — periomètre optionnel, à confirmer par l'owner avant armement (aucune
  incohérence bloquante détectée, juste un polish de conformité token).
- Batch 7 (QA visuelle) dépend de la complétion de 3-6 (ou du sous-ensemble réellement armé).
- Batch 8 ne doit pas être armé avant que 3-7 (ou le sous-ensemble retenu) soient mergés — role
  intégrateur, checkpoint niveau C.

## Écart avec la recommandation initiale du batch 1

Le batch 1 recommandait de prioriser "canonisation headers / routes orphelines / rgba()" sans
détailler le découpage. Ce batch (2, planner) affine : la canonisation headers s'est révélée **plus
étroite** que documenté (page-level déjà fait, seul le niveau section/carte reste ouvert — voir
`IA_TARGET.md` §2a) et les "routes orphelines" sont **à moitié déjà résolues** (3 sur 6 déjà
enregistrées avec `hideFromSubNav`, voir `IA_TARGET.md` §2b). Le découpage batch 3-8 reflète cette
correction plutôt que la formulation large du batch 1.
