# Frontend API-only policy (PROMPT 218)

**The Hearst Connect frontend consumes its own server surface only.**
**No direct blockchain, database, mining, market, or smart-contract reads from client code.**
**No silent fallback. No client-owned business computation.**

---

## Ce que ce document acte

Le navigateur (code `"use client"`) ne parle **jamais** à une source métier directe.
Toute lecture métier — vault, stratégies, mining, électricité, moteur, événements,
prix marché — passe par la **frontière serveur** de l'app, puis redescend au client
en DTO sérialisés.

```
Smart contract / source externe
   ↓  (viem / provider — SERVER ONLY)
src/lib/chain/dynavault.ts  ·  src/lib/data/*  ·  Prisma        ← server-only
   ↓
Server Components  ·  route handlers /api/*                     ← frontière serveur
   ↓  (DTO sérialisés : Wired<T>, JSON, jamais un tuple ABI / BigInt brut)
Composants client  ("use client")                              ← présentation seule
```

## Interprétation de « GPU1 » dans ce repo (écart assumé avec la lettre du prompt)

> **Décision plateforme NON prise dans cette passe.** Le PROMPT 218 décrit une
> cible où un back-end **physiquement séparé sur la machine GPU1** (domaine + API
> + indexeur + DB propres) devient l'unique source, et où Next.js n'est plus
> qu'un client HTTP. **Ce n'est pas l'architecture actuelle** et ce n'est pas ce
> qui a été construit ici :
>
> - Hearst Connect est déployé sur **Vercel** (`connect.hearst.app`), DB =
>   **Supabase Postgres**. GPU1 héberge d'AUTRES services (Hedge, myclaw, vLLM —
>   cf. `Local Server/INFRA.md`), pas le back-end de Connect.
> - Le pattern canonique documenté est **Server Component → Prisma** en direct
>   (`docs/BACKEND_CONTEXT.md`), pas un appel HTTP vers un service tiers.
>
> Migrer vers un back-end GPU1 séparé = **re-plateformage** (sortie de Vercel pour
> la couche data, réécriture des loaders en client HTTP) : plusieurs passes,
> irréversible, hors mode quick. **À décider explicitement.**
>
> **Cette passe verrouille l'invariant qui compte réellement et immédiatement :**
> le code **client** ne contourne jamais la frontière serveur. C'est le §2/§3/§4
> du prompt appliqué à l'archi en place. Le « GPU1 » logique = la frontière
> serveur de l'app (Server Components + `dynavault.ts` server-only + `/api`).

## Ce qui est vrai aujourd'hui (vérifié, pas déclaré)

- **0 / 133** composants client importent `viem`/`wagmi`/`ethers`/Prisma runtime/
  l'adaptateur chain. (`no-client-chain-access.test.ts`)
- **0** `fetch()` vers un domaine externe dans du code client.
- `src/lib/chain/dynavault.ts` (parle viem/RPC) est désormais **`server-only`** —
  le build casse si un client l'importe. `keeper.ts`, `db.ts`, les providers
  `data/*` externes étaient déjà `server-only`.
- Les lectures chain honnêtes (`Wired<T>` : `LIVE` / `UNAVAILABLE` /
  `NOT_CONFIGURED` / `NOT_SUPPORTED`) ne fabriquent jamais de valeur — le client
  ne transforme jamais `UNAVAILABLE` en zéro ni `NOT_CONFIGURED` en fixture.

## Verrou

`src/lib/chain/__tests__/no-client-chain-access.test.ts` échoue si :
1. un module `"use client"` acquiert un import **de valeur** vers chain/DB/
   provider externe (les `import type` sont ignorés — effacés à la compilation) ;
2. `dynavault.ts` / `keeper.ts` / `db.ts` perdent leur marqueur `server-only`.

## Exception documentée (§19)

**Connexion wallet + signature locale** par l'utilisateur d'une transaction
**préparée côté serveur** sera autorisée en code client (wallet client viem/wagmi),
mais **jamais une lecture métier**. Aucun tel client n'existe encore ; à son
ajout, restreindre l'allowlist du guard à ce fichier précis.

## Ce qui reste à décider (hors cette passe)

- **Le vrai back-end GPU1 séparé** (si le pivot plateforme est confirmé) — voir
  encadré ci-dessus.
- **L'indexeur d'événements v2** : les 14 events sont dans l'ABF (`dynavault.ts`)
  mais rien ne les ingère/persiste encore (le contrat n'est pas déployé). Cf.
  `docs/smart-contract-v2-status.md`.
