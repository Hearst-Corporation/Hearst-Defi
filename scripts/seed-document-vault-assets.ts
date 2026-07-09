/**
 * Seeds the `document_vault_assets` catalogue from the provenance-based asset
 * bank shipped in hearst-docs-vault (lib/assets/asset-registry.ts). These are
 * real files under hearst-docs-vault/public/brand + /decks/assets — this seed
 * only records their metadata in the DB so the backend /api/document-vault/assets
 * endpoint returns a real catalogue. NO files are copied or downloaded; `path`
 * stays a public URL the docs-vault frontend already serves.
 *
 * Idempotent: re-running upserts by a stable id. Cross-project scoped assets are
 * NOT user-scoped (shared catalogue). Safe in prod (additive, no user data).
 *
 *   pnpm seed:document-vault-assets
 */
import { makePrismaClient } from "./lib/prisma-cli";

type SeedAsset = {
  id: string;
  project: string;
  type: string;
  title: string;
  path: string;
  tags: string[];
  usage: string[];
  confidence: string;
  source: string;
};

// Mirror of the curated, provenance-based bank (data only, not imported code —
// cross-repo imports are forbidden). Every entry is a real file with a source.
const ASSETS: SeedAsset[] = [
  { id: "connect-logo", project: "hearst-connect", type: "logo", title: "Hearst Connect logo", path: "/brand/hearst-connect/logos/hearst-connect-logo.svg", tags: ["hearst", "connect", "logo"], usage: ["cover", "header", "closing"], confidence: "confirmed", source: "connect — Hearst Defi/public/logos/hearst-connect.svg" },
  { id: "connect-logo-dark", project: "hearst-connect", type: "logo", title: "Hearst Connect logo (dark)", path: "/brand/hearst-connect/logos/hearst-connect-logo-dark.svg", tags: ["hearst", "connect", "logo", "dark"], usage: ["cover", "footer"], confidence: "confirmed", source: "connect — Hearst Defi/public/logos/hearst-connect-dark.svg" },
  { id: "compute-logo", project: "hearst-compute", type: "logo", title: "Hearst Compute logo", path: "/brand/hearst-compute/logos/hearst-compute-logo.svg", tags: ["hearst", "compute", "logo"], usage: ["cover", "header", "closing"], confidence: "confirmed", source: "Hearst Compute/public/logos/hearst-connect.svg" },
  { id: "compute-platform-screenshot", project: "hearst-compute", type: "screenshot", title: "Compute platform", path: "/brand/hearst-compute/screenshots/compute-platform.png", tags: ["compute", "platform", "product", "ui"], usage: ["product", "statement", "chart-panel"], confidence: "confirmed", source: "Hearst Compute/public/platform-screenshot.png" },
  { id: "ai-logo", project: "hearst-ai", type: "logo", title: "Hearst AI logo", path: "/brand/hearst-ai/logos/hearst-ai-logo.svg", tags: ["hearst", "ai", "logo", "teal"], usage: ["cover", "header", "closing"], confidence: "confirmed", source: "hearst-ai/public/logo.svg" },
  { id: "ai-platform-screenshot", project: "hearst-ai", type: "screenshot", title: "Hearst AI platform", path: "/brand/hearst-ai/screenshots/ai-platform.png", tags: ["ai", "platform", "product", "dashboard"], usage: ["product", "statement", "chart-panel"], confidence: "confirmed", source: "hearst-ai/public/platform-screenshot.png" },
  { id: "investor-photo-mining-site", project: "investor-vault", type: "photo", title: "Solar / mining site (aerial)", path: "/decks/assets/36347ec2c573553f.png", tags: ["mining", "solar", "infrastructure", "aerial", "energy"], usage: ["cover", "statement", "product"], confidence: "confirmed", source: "Investor deck (Figma 0:1)" },
  { id: "investor-photo-datacenter", project: "investor-vault", type: "photo", title: "Data center / compute", path: "/decks/assets/f9a218ea39f02fa8.png", tags: ["compute", "datacenter", "ai", "hardware"], usage: ["cover", "product", "statement"], confidence: "confirmed", source: "Investor deck (Figma 0:1)" },
  { id: "compute-partner-fireblocks", project: "hearst-compute", type: "partner-logo", title: "Partner — FIREBLOCKS", path: "/brand/hearst-compute/partners/fireblocks.png", tags: ["partner", "fireblocks", "ecosystem"], usage: ["proof", "partners", "three-cards"], confidence: "confirmed", source: "Hearst Compute/public/logos/partners/fireblocks.png" },
  { id: "compute-partner-mubadala", project: "hearst-compute", type: "partner-logo", title: "Partner — MUBADALA", path: "/brand/hearst-compute/partners/mubadala.png", tags: ["partner", "mubadala", "ecosystem"], usage: ["proof", "partners", "three-cards"], confidence: "confirmed", source: "Hearst Compute/public/logos/partners/mubadala.png" },
  { id: "shared-logo-hearst-mark", project: "shared", type: "mark", title: "Hearst mark (green H)", path: "/brand/logos/wordmark-f7ab5eea98195961.svg", tags: ["hearst", "logo", "mark", "green"], usage: ["cover", "closing", "header"], confidence: "confirmed", source: "Investor deck wordmark" },
  { id: "shared-pattern-dot-grid-green", project: "shared", type: "pattern", title: "Green dot grid", path: "/brand/patterns/dot-grid-green.svg", tags: ["texture", "grid", "green", "background"], usage: ["cover", "closing"], confidence: "confirmed", source: "generated (vault)" },
  { id: "shared-chart-bar-placeholder", project: "shared", type: "chart", title: "Bar chart placeholder", path: "/brand/charts/bar-placeholder.svg", tags: ["chart", "bars", "financials", "growth"], usage: ["chart-panel", "financials"], confidence: "confirmed", source: "generated (vault)" },
  { id: "shared-placeholder-photo-dark", project: "shared", type: "placeholder", title: "Photo placeholder (dark)", path: "/brand/placeholders/photo-dark.svg", tags: ["placeholder", "image", "dark"], usage: ["cover", "product", "statement"], confidence: "confirmed", source: "generated (vault)" },
  { id: "shared-placeholder-photo-light", project: "shared", type: "placeholder", title: "Photo placeholder (light)", path: "/brand/placeholders/photo-light.svg", tags: ["placeholder", "image", "light"], usage: ["product", "statement"], confidence: "confirmed", source: "generated (vault)" },
];

async function main(): Promise<void> {
  const prisma = makePrismaClient();
  let upserted = 0;
  for (const a of ASSETS) {
    const metadataJson = {
      tags: a.tags,
      usage: a.usage,
      confidence: a.confidence,
      source: a.source,
    };
    await prisma.documentVaultAsset.upsert({
      where: { id: a.id },
      create: {
        id: a.id,
        project: a.project,
        type: a.type,
        title: a.title,
        path: a.path,
        metadataJson,
      },
      update: {
        project: a.project,
        type: a.type,
        title: a.title,
        path: a.path,
        metadataJson,
      },
    });
    upserted += 1;
  }
  const total = await prisma.documentVaultAsset.count();
  console.log(`[seed] document_vault_assets: ${upserted} upserted, ${total} total.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
