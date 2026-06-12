---
description: Audit complet du design system — exécute tous les audits (tokens, layout, typo, motion, primitives)
---

# /ds-full — Design System Full Audit

## Objectif
Exécuter l'audit complet du design system en chaînant tous les sous-audits.

## Commande

Exécute séquentiellement :
1. `/ds-tokens` — Audit des tokens
2. `/ds-layout` — Audit du layout
3. `/ds-typo` — Audit typographie
4. `/ds-motion` — Audit motion
5. `/ds-primitives` — Audit primitives

## Rapport final

```
═══════════════════════════════════════════════════════════════
🔒 DESIGN SYSTEM FULL AUDIT — Hearst Connect
Date : [auto]
Verrou : 2026-05-20
═══════════════════════════════════════════════════════════════

[Insérer rapport /ds-tokens]

[Insérer rapport /ds-layout]

[Insérer rapport /ds-typo]

[Insérer rapport /ds-motion]

[Insérer rapport /ds-primitives]

═══════════════════════════════════════════════════════════════
📊 RÉCAPITULATIF
═══════════════════════════════════════════════════════════════
Tokens    : ✅ Pass / ❌ Fail
Layout    : ✅ Pass / ❌ Fail
Typo      : ✅ Pass / ❌ Fail
Motion    : ✅ Pass / ❌ Fail
Primitives: ✅ Pass / ❌ Fail

Score global : X/5

🔧 Actions requises :
- [liste des corrections]

⚠️  Si une violation est détectée, ne pas continuer l'implémentation.
    Stop, corriger, re-auditer.
═══════════════════════════════════════════════════════════════
```

## Règle d'or
> **Canon surfaces = ADR-013** : `.ct-glass-panel` / `Card` par défaut. `.ct-system-panel`, `.glass-panel`, flat admin = DEPRECATED — signaler comme P1 migration, pas comme spec valide.

> **Nouveaux tokens/primitives** : validation explicite Adrien uniquement (voir README § Process pour ajouter un token). Les utilitaires déjà dans `globals.css` / `cockpit.css` (`ct-text-on-accent`, etc.) font partie du canon — ne pas les rejeter.

Si l'audit révèle un besoin non couvert par le vocabulaire actuel :
1. **Stop l'implémentation.**
2. Rédiger une demande d'ajout avec : Quoi / Pourquoi / Pourquoi l'existant ne suffit pas / Alternative.
3. Attendre validation.
