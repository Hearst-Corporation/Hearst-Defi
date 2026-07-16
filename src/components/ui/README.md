# Legacy UI primitives — compatibility layer

**Deprecated.** This folder is not the design system authority — do not add new visual primitives here.

## Canonical authority

→ `src/components/catalyst/` (see `README.md` there)

## Allowed temporarily

| File | Role | Migrate to |
|------|------|------------|
| `provenance-badge.tsx` | Re-export shim | `@/components/catalyst/provenance-badge` |
| `card.tsx` | Re-export shim | `@/components/catalyst/card` |
| `chart.tsx` | **Chart layer** (Recharts + `--ct-*`) — documented exception | stays here |
| `client-toaster.tsx` | Sonner bridge | stays here |
| `toaster.tsx` | Sonner wrapper | stays here |

## Forbidden

- New Badge/Button/Table/Input/Card systems
- New `BENTO_*_BTN` string constants
- Raw hex / zinc / `font-mono` in new code

Removal: when grep shows zero imports of shims outside compatibility tests.
