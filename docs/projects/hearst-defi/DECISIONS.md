# DECISIONS.md — Hearst DeFi Recovery Series

> Log des décisions prises AU COURS de la Recovery Series (≠ ADRs du projet).
> Chaque décision est une bifurcation non triviale nécessitant l'accord d'Adrien.

---

## Décisions en attente (batch 6)

Les items suivants doivent être tranchés par Adrien avant le batch 6 :

1. **dev.db alignment** : `db push --accept-data-loss` (efface les données locales dev) OU solution chirurgicale (`CREATE INDEX` seulement si pas de doublons) ?
2. **Engine backtest rules-vs-no-rules** : définir la baseline "sans règles" → nécessite bump Methodology v1.0 → v2.x ?
3. **Share Class B sélecteur invest** : feu vert pour ajouter le sélecteur dans le flux invest ?
4. **Features Lot 5 non câblées** : câbler maintenant (global search, notifications, ⌘K, etc.) ou continuer à différer ?
5. **Playwright bloquant (C-14)** : activer `continue-on-error: false` seulement quand la suite E2E est verte — confirmer qu'on veut la fixer maintenant ?
6. **Cookie `sameSite: strict` (C-11)** : vérifier que le flow Privy popup survit — tester manuellement avant merge ?

---

## Décisions prises

_(vide — batch 1 est lecture seule)_

---

*Mis à jour au fil des batches.*
