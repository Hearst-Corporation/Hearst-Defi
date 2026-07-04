# Session live — `/apply` user flow — 2026-07-04

Document de suivi et de validation, tenu à jour au fil de la session. C'est la
**source de vérité** de cette passe de corrections — on coche au fur et à mesure,
on n'écrase pas l'historique, on ajoute des lignes.

Serveur dev : `http://localhost:4105/apply` (branche `main`, port 4105).
DB active en local : **Supabase PROD** `xrwzxhsenwmlxbwqcftz` (`.env.local` pointe
sur `hearst-connect-prod`, pas de SQLite locale) — toute vérification DB doit rester
lecture seule sauf accord explicite.

---

## Statut global

| # | Tâche | Statut | Agent / Owner | Notes |
|---|---|---|---|---|
| 1 | Scan initial du flow /apply (5 steps, code, DB, tests) | ✅ Fait | Explore (inline) | Rapport complet en conversation |
| 2 | Audit alignement / hardcode / dead code sur /apply | ✅ Fait | Explore (background) | Voir résultat ci-dessous |
| 3 | Pattern "petits points" (login) appliqué sur /apply, sans glow | ✅ Mergé sur main — commit `89205818` | ui-dev (worktree) | `onboarding.css` `.onboarding-shell--wide::after` |
| 4 | Vérif DB : email dupliqué refusé + confirmation prod/local | ✅ Fait | general-purpose (background) | Voir résultat ci-dessous |
| 5 | Doc de suivi HTML/MD (ce fichier) | ✅ Fait | orchestrateur | — |

---

## Rapport initial — architecture du flow (référence)

Fichiers clés :
- `src/app/apply/page.tsx` — route (Server Component)
- `src/app/apply/layout.tsx` — layout onboarding (importe aussi CSS onboarding + doc-flow)
- `src/app/apply/apply-form.tsx` — wizard client, state machine 5 steps (367 lignes)
- `src/app/apply/actions.ts` — Server Action `submitApplication`
- `src/lib/qualification/options.ts` — options des choix (platformType/aum/vaultSize/timeline)
- `src/lib/agents/qualification.ts` — `createInvestorFromWebhook`, `upsertQualification`
- `prisma/schema.prisma` — modèles `User` (l.325), `QualificationProfile` (l.604)
- DS : `wizard-step-progress.tsx`, `choice-card.tsx`, `onboarding-chamber.tsx`

5 steps : About you → Profile → Capacity → Allocation → Timing.
Soumission → upsert `QualificationProfile` + création `User`/`Investor` si email inconnu
+ email de bienvenue + sync HubSpot (best-effort, non bloquant).

### Problèmes déjà identifiés (scan initial, à confirmer/traiter)

- [ ] `fundsUsage` / `yieldStatus` / `yieldType` existent dans Zod + Prisma + HubSpot
      mais AUCUN step du wizard ne les collecte — choix produit assumé ou régression
      à clarifier.
- [ ] Aucune validation sur les steps 2 à 5 (Profile/Capacity/Allocation/Timing) —
      on peut "Continue" sans rien sélectionner.
- [ ] State du wizard non persisté (pas de sessionStorage/URL param) — refresh =
      perte de saisie sans avertissement.
- [ ] `disabled={pending}` absent sur les boutons "Continue" intermédiaires
      (présent seulement sur Back et Submit final).
- [ ] Regex email client permissive (garde-fou UX seulement, la vraie validation
      est serveur via Zod `.email()`).
- [ ] Message d'erreur serveur générique ("Invalid input — check the email
      address.") même si l'erreur ne vient pas de l'email — `field` renvoyé par
      l'action mais jamais lu côté client.
- [ ] `phone` sans validation de format (juste `.max(40)`).
- [ ] Pas de garde anti-double-clic réseau avant re-render (`upsertQualification`
      reste idempotent donc risque faible).
- [ ] Aucun test dédié au wizard (`apply-form.tsx`, `actions.ts`) — seul le
      routing "bare shell" est testé.
- [ ] Couplage CSS : `layout.tsx` importe `(product)/onboarding/onboarding.css` +
      `doc-flow.css` — toute modif CSS onboarding impacte aussi `/apply`.

---

## Tâches en cours (demande Adrien 2026-07-04)

| # | Tâche | Statut | Détail |
|---|---|---|---|
| 6 | Box à taille FIXE sur tous les steps (n'agrandit pas sur erreur ni entre steps) | 🔄 Worker en cours | Slot d'erreur réservé + `min-h` sur body (tokens, pas de px magique) |
| 7 | 5 réponses par step à choix (Profile + Timing passent de 4 → 5) | 🔄 Worker en cours | +`Other / not listed` (Profile), +`Not sure yet` (Timing) ; Capacity/Allocation déjà à 5 |

RÈGLE ABSOLUE actée : **je ne me connecte plus jamais au navigateur** — Adrien
envoie lui-même les captures pour validation visuelle.

---

## Journal des corrections live

_(une entrée par fix appliqué et validé visuellement — capture avant/après si pertinent)_

| Horodatage | Fix | Fichier(s) | Validé par capture ? | Commit |
|---|---|---|---|---|
| — | — | — | — | — |

---

## Résultat vérif DB (tâche 4) — 2026-07-04

- **DB active = PROD** (`xrwzxhsenwmlxbwqcftz` / `hearst-connect-prod`). Le dev local
  écrit dans la vraie base → toute soumission `/apply` de test crée un vrai `User`.
- **Email dupliqué refusé proprement (réponse a)** : `findUnique({ where: { email } })`
  avant toute création (`actions.ts:70-87`), double garde `qualification.ts:465-468`,
  et contrainte DB réelle `email @unique` sur `User` (`schema.prisma:327`).
- Base propre : 12 users / 12 emails distincts / 0 doublon.
- ⚠️ **Bémol robustesse (pas un bug de doublon)** : la violation `P2002` (race
  condition) n'est PAS catchée dans `submitApplication`/`createInvestorFromWebhook` →
  l'utilisateur verrait une erreur serveur brute au lieu d'un message propre. Aucun
  doublon créé grâce à `@unique`, mais mauvaise UX sur ce cas limite.
  - [ ] Décision : catch `P2002` et renvoyer un message propre ? (à trancher)

---

## Résultat audit alignement / hardcode / dead code (tâche 2) — 2026-07-04

- **Alignement** : RAS. Tout via tokens `--ct-*`, y compris gap First/Last name
  (`--ct-space-3` = 12px, cohérent DS). Aucun px brut, aucune couleur inline,
  aucun z-index magique, aucun border-radius en dur.
- **Hardcode / duplication (sévérité moyenne)** :
  - [ ] Disclaimer réglementaire dupliqué en dur : `apply-form.tsx:314-317` vs
        `confirmed/page.tsx:95-97` — 2 sources de vérité pour le même texte
        juridique. Fix : extraire une constante `APPLY_COMPLIANCE_DISCLAIMER`.
  - [ ] Regex email `^[^\s@]+@[^\s@]+\.[^\s@]+$` dupliquée : `apply-form.tsx:96`
        vs `admin/outreach/actions.ts:132`. Fix : centraliser en util partagée.
- **Dead code (sévérité faible, scoped à /apply)** :
  - [ ] `fundsUsage`/`yieldStatus`/`yieldType` dans le Zod `Input` + FormData de
        `actions.ts:31-33,57-59` mais JAMAIS collectés par le wizard → code mort
        dans ce flow (les 3 champs restent utilisés ailleurs via Typeform/admin,
        donc pas morts au niveau projet). Fix : retirer du flow apply OU documenter.
- **Rien d'autre** : pas d'import inutilisé, pas de composant dupliqué,
  `ChoiceCard`/`ChoiceGroup` bien réutilisés, `StepHeading` local légitime.

---

## Décisions produit actées pendant la session

_(ex : "steps 2-5 restent non bloquants, c'est voulu" — noté ici pour ne pas re-débattre)_

- —
