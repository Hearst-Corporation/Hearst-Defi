# Hearst Connect Design System Authority

## Canonical decision

Hearst Connect **migrates toward Catalyst**, not away from it.

Canonical layers:

1. `cockpit-shell/`
   - shell
   - layout
   - rails
   - responsive cockpit contract
   - `--ct-*` tokens

2. `src/components/catalyst/`
   - canonical UI component layer
   - must be branded with cockpit `--ct-*` tokens
   - destination for Button, Badge, Table, Input, Select, Card, Dialog, Field, etc.

Deprecated layer:

3. `src/components/ui/`
   - legacy homegrown primitives
   - do not add new visual primitives here
   - migrate usages into Catalyst or convert to temporary Catalyst wrappers

Non-negotiable:

Do not migrate away from Catalyst.
Do not describe Catalyst as the intruder.
Do not promote `src/components/ui` as the DS authority.
Cockpit tokens brand Catalyst.

## Allowed imports

- `@/components/catalyst/*` — the canonical component layer. Prefer this for every
  new Button / Badge / Table / Input / Select / Dialog / Field surface.
- `cockpit-shell` (alias `@hearst/cockpit-shell`) — shell, rails, layout contract.
- `@/components/ui/*` — **only** existing legacy usages, or temporary wrappers that
  delegate to Catalyst during migration. No new visual primitive.

## Forbidden imports / patterns

- A **new** visual primitive added to `src/components/ui/` (Badge/Button/Table/Input/Card system).
- Page-local Button / Badge / Table / Input recreated inline inside a page or feature folder.
- Raw Tailwind `blue` / `zinc` styling promoted as the visual authority (focus ring, borders, text).
- Hardcoded `#A7FB90` outside token definitions — use `var(--ct-accent)`.
- A second green, a `--ds-*` namespace, or a `tailwind.config.js`.

## How to migrate a component from `ui/` to Catalyst

1. Find the Catalyst equivalent in `src/components/catalyst/` (Button, Badge, Table…).
2. Confirm it is token-branded (`--ct-*`); if a hardcode is found, tokenize it there.
3. Swap the import at the call site (`@/components/ui/x` → `@/components/catalyst/x`).
4. Adjust props to the Catalyst API; keep the rendered result visually stable.
5. If a `ui/` file has zero remaining consumers, it becomes a deletion candidate
   (handled by a dedicated cleanup pass, not silently here).
6. If a clean swap is not yet possible, convert the `ui/` file into a thin wrapper
   that delegates to Catalyst, so the visual authority is Catalyst even temporarily.

## No raw blue / zinc

Catalyst ships with Tailwind `zinc`/`blue` defaults. In Hearst Connect those are
**branded out** via `--ct-*` tokens. Never introduce a new raw `blue`/`zinc` recipe
as the visual source of truth. Focus ring = `--ct-accent`, not `ring-blue`.

## No hardcoded `#A7FB90`

The single green is `--ct-accent`. Use `var(--ct-accent)` or
`color-mix(in_srgb, var(--ct-accent) <N>%, transparent)`. Raw `#A7FB90` is banned
outside the token definition itself (enforced by `pnpm ds:guard`).

## No page-local Button / Badge / Table / Input

Primitives live in the canonical layers, never re-declared inside a page or feature
folder. Reuse Catalyst (or, transitionally, the existing `ui/` primitive) — do not
invent a competing one.

## Responsive shell rule

Validate **full screen** with the assistant rail **open and closed**. No global
overflow; tables scroll locally inside their card. The cockpit shell contract lives
in `cockpit-shell/` — do not duplicate its layout in a page.

## Tests / guards

- `pnpm ds:guard` — `scripts/ds-hardcode-guard.mjs`, anti-regression hardcode scan.
- `src/lib/ds/__tests__/ds-authority-lock.test.ts` — asserts this authority is
  documented, that the layer READMEs exist, and that no doc/rule reverses the
  Catalyst decision (e.g. promoting `src/components/ui` as the authority).

## Related authority docs

- `src/components/catalyst/README.md` — canonical layer contract.
- `src/components/ui/README.md` — legacy / deprecated contract.
- `docs/CATALYST_CANON_REFERENCE.md` — typography roles branded onto Catalyst.
- `docs/DS_SINGLE_SOURCE_OF_TRUTH.md` — conflict-resolution hierarchy.
- `.cursor/rules/design-system.mdc` — token cascade + anti-regression rules.
