# REPORT_SKELETON.md — Agentic Full Test Series: Final Report (skeleton)

> Squelette posé par le batch 1/6 (architect). **Ne pas remplir maintenant** — ce
> document définit la structure que le dernier batch de la série (ou un futur batch de
> synthèse, si la série est étendue au-delà de 6) devra compléter à partir des
> `HANDOFF.md` cumulés des batchs 2-6. Chaque section porte une note `[À REMPLIR PAR
> BATCH X]` indiquant la source attendue.

---

# Rapport final — Ligne agentique Hearst Connect : couverture de test

**Série** : `series_opus_agentic_hearst-defi` · **Batchs** : 1-6 · **Date de clôture** :
`[À REMPLIR — date du dernier batch]`

## 1. Résumé exécutif

`[À REMPLIR PAR LE DERNIER BATCH]` — 5-10 lignes : combien de composants de la ligne
agentique (voir `INVENTORY.md`, 22 entrées : 8 Partie A + 15 Partie B minus le
recouvrement A5/B14) ont désormais une matrice de formulations couverte (valide/reject/
limite), combien de requêtes DLLM réelles ont été consommées sur le budget de 50, quels
gaps subsistent volontairement (hors scope) vs involontairement (à traiter par une future
série).

## 2. Périmètre couvert par cette série

- Renvoi vers `INVENTORY.md` (cartographie complète) et `PROJECT_PLAN.md` §Coordination
  (frontière avec `docs/projects/outreach-audit/`).
- Tableau des 5 zones testées (voir `BATCHES.md`) avec statut final de chacune.
- Rappel explicite de ce qui est **hors périmètre** : logique outreach-spécifique
  (série sœur), `electron/__tests__`, `contracts/test/` (confirmés sans rapport avec
  l'agentique par le batch 1).

## 3. Méthodologie

- Rappel du protocole `PROJECT_PLAN.md` §Protocole de test (budget DLLM ≤50, jamais 100 ;
  mock-first ; canary réel réservé aux zones 4-5).
- Rappel de la matrice de formulations (`COVERAGE_MATRIX.md` Partie 2) utilisée comme
  grille commune à tous les batchs.

## 4. Résultats par zone

### Zone 1 — Routeur d'intent + observabilité + quality review
`[À REMPLIR PAR BATCH 2]` — tests ajoutés/complétés, gaps comblés (`quality-review.ts`
isolé — voir `COVERAGE_MATRIX.md` §Synthèse point 3), gaps restants, requêtes DLLM
consommées (attendu : 0).

### Zone 2 — Action readiness / tool boundary / crew simulation / swarm
`[À REMPLIR PAR BATCH 3]` — idem, requêtes DLLM consommées (attendu : 0).

### Zone 3 — API read-only agentic + control center + control tower + simulation observability
`[À REMPLIR PAR BATCH 4]` — idem, y compris confirmation de la couverture de l'opt-in
`observability:{record:true}` (voir `COVERAGE_MATRIX.md` §Synthèse point 4). Requêtes
DLLM consommées (attendu : 0).

### Zone 4 — 4 agents batch + reporting crew + product projection swarm
`[À REMPLIR PAR BATCH 5]` — tests de seuils Mining Health / sélection Risk Explanation
(gap prioritaire identifié en `COVERAGE_MATRIX.md` §Synthèse point 1), résultats des
canaries DLLM réels le cas échéant (formulation testée, agent, sortie observée, conforme
au schéma Zod / aux garde-fous ou non). Requêtes DLLM consommées (budget indicatif ≤24).

### Zone 5 — Cockpit chat core (moteur + guards + tool registry)
`[À REMPLIR PAR BATCH 6]` — confirmation du test isolé du kill-switch
`CHAT_MASTER_AGENT=0` (gap identifié en `COVERAGE_MATRIX.md` §Synthèse point 2), résultats
des canaries DLLM réels (LP / Admin / Review). Requêtes DLLM consommées (budget indicatif
≤26).

## 5. Registre du budget DLLM (cumulatif)

`[À REMPLIR — un tableau cumulé depuis les `HANDOFF.md` de chaque batch]`

| Batch | Requêtes DLLM réelles consommées | Cible | Formulations testées |
|---|---|---|---|
| 2/6 | — | 0 | — |
| 3/6 | — | 0 | — |
| 4/6 | — | 0 | — |
| 5/6 | — | ≤24 | — |
| 6/6 | — | ≤26 | — |
| **Total** | — | **≤50 (jamais 100)** | — |

## 6. Gaps restants et recommandations

`[À REMPLIR PAR LE DERNIER BATCH]` — liste des lacunes volontairement laissées de côté
(hors scope de cette série) vs celles qui mériteraient une série de suivi (ex. Daily
Executive Brief Crew — A8, non construit ; crew runtime CrewAI réel ; extraction du chat
engine/context composer).

## 7. Annexe — schéma complet de la ligne agentique

Renvoi vers `PIPELINE_SCHEMA.md` (squelette posé par ce batch, à compléter avec les
constats de comportement réel observés pendant les batchs 2-6 — ex. si un canary DLLM
révèle un comportement non documenté, l'annoter sur le schéma plutôt que seulement dans
le rapport texte).

---

## Comment ce squelette doit être rempli

1. Chaque batch 2-6 édite **uniquement sa propre section** (§4, sa zone) + ajoute sa
   ligne au tableau §5 — jamais les sections des autres batchs (pas de conflit de lock,
   chaque section est indépendante par construction).
2. Le dernier batch (6/6, ou un batch de synthèse dédié si la série est étendue) remplit
   §1, §2 (statut final), §6, et vérifie la cohérence du tableau §5 (somme ≤50).
3. Aucun batch ne doit supprimer les notes `[À REMPLIR PAR BATCH X]` avant d'avoir
   effectivement rempli la section correspondante — elles servent de check-list visuelle
   de complétude pour le batch suivant.
