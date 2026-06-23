# Phase 1: Fondations - Prompt pour Agent Kimi 2.5

## Contexte
Tu es un agent spécialisé Next.js/React/TypeScript. Tu dois créer les fondations architecturales du nouveau module portfolio.

## Livrables attendus

### 1. Structure dossiers
Créer l'arborescence:
```
src/components/portfolio/_core/
src/components/portfolio/chart/geometry/
src/components/portfolio/chart/components/
src/components/portfolio/yield/hooks/
src/components/portfolio/positions/
src/components/portfolio/distributions/
src/components/portfolio/status/
src/lib/portfolio/formatters/
src/lib/portfolio/geometry/
src/lib/portfolio/data/
src/styles/portfolio/
```

### 2. Extraction constants SVG
Créer `src/lib/portfolio/geometry/svgConstants.ts`:
```typescript
/**
 * ViewBox et géométrie SVG pour les charts portfolio.
 * Ces valeurs sont intentionnellement fixes pour la cohérence visuelle.
 */
export const VIEWBOX = {
  width: 200,
  height: 62,
  paddingY: 5,
} as const;

export const STROKE = {
  default: 1.5,
  hover: 2,
} as const;

export const COLORS = {
  accent: 'var(--ct-accent)',
  neutral: 'var(--ct-text-neutral)',
  muted: 'var(--ct-text-muted)',
} as const;
```

### 3. Centralisation formatters
Créer `src/lib/portfolio/formatters/` avec:

**formatCurrency.ts**:
```typescript
import { formatUsdCompact, formatUsdFull } from '@/lib/vaults/product-display';

export { formatUsdCompact, formatUsdFull };

export function formatUsdRange(low: number, high: number): string {
  return `${formatUsdCompact(low)}–${formatUsdCompact(high)}`;
}
```

**formatDate.ts**:
```typescript
/**
 * Format dates portfolio - toujours en UTC, jamais de date relative
 */
export function formatPortfolioDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatDistribMonth(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
}
```

**formatApy.ts**:
```typescript
import { formatApyRange } from '@/lib/format/apy';

export { formatApyRange };

export function formatBlendedApy(low: number, high: number): string {
  // Force format range, jamais single-point
  return formatApyRange(low, high);
}
```

### 4. PfCockpitPanel refactor
Créer `src/components/portfolio/_core/PfCockpitPanel.tsx` (<80 lignes):
```typescript
"use client";

import { cn } from "@/lib/cn";

interface PfCockpitPanelProps {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  rightSlot?: React.ReactNode;
  footer?: React.ReactNode;
}

export function PfCockpitPanel({
  children,
  className,
  title,
  rightSlot,
  footer,
}: PfCockpitPanelProps) {
  return (
    <div className={cn("pf-panel", className)}>
      {(title || rightSlot) && (
        <div className="pf-panel__header">
          {title && <h3 className="pf-panel__title">{title}</h3>}
          {rightSlot && <div className="pf-panel__actions">{rightSlot}</div>}
        </div>
      )}
      <div className="pf-panel__body">{children}</div>
      {footer && <div className="pf-panel__footer">{footer}</div>}
    </div>
  );
}
```

### 5. Hook data portfolio
Créer `src/components/portfolio/_core/usePortfolioData.ts`:
```typescript
"use client";

import { use } from "react";
import type { PortfolioData } from "@/lib/data/portfolio";

export function usePortfolioData(dataPromise: Promise<PortfolioData>): PortfolioData {
  return use(dataPromise);
}
```

## Guardrails à respecter

### STOP si:
- Un fichier fait >80 lignes
- Duplication avec code existant
- Magic number non constantifié
- Test fail

### Validations avant fin:
```bash
pnpm typecheck
pnpm test src/lib/portfolio/formatters
```

## Dépendances
- Utiliser les types existants de `@/lib/data/portfolio`
- Réutiliser `formatUsdCompact` de `@/lib/vaults/product-display`
- Réutiliser `formatApyRange` de `@/lib/format/apy`
- Ne PAS importer depuis l'ancien structure

## Commit message template
```
refactor(portfolio): Phase 1 - fondations architecturales

- Structure dossiers nouvelle architecture
- Constants SVG extraites et typées
- Formatters centralisés (currency, date, apy)
- PfCockpitPanel refactoré (<80 lignes)
- Hook usePortfolioData créé

Part of portfolio rewrite orchestration.
```
