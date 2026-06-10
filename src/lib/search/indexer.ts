import "server-only";

import { prisma } from "@/lib/db";
import {
  ADDRESS_RE,
  TX_HASH_RE,
  ID_PREFIX_MAP,
  MAX_PER_SECTION,
  type Entity,
  type SearchResult,
  type SearchApiResponse,
} from "./types";

// ---------------------------------------------------------------------------
// Levenshtein-based fuzzy score (pure, no deps)
// ---------------------------------------------------------------------------

/** Returns a score in [0, 1] — higher is better. 1 = exact substring match. */
function fuzzyScore(haystack: string, needle: string): number {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (h.includes(n)) return 1;
  if (n.length === 0) return 0;

  // Levenshtein distance (optimised two-row variant)
  const lenH = h.length;
  const lenN = n.length;
  let prev = Array.from({ length: lenN + 1 }, (_, i) => i);
  for (let i = 1; i <= lenH; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= lenN; j++) {
      const cost = h[i - 1] === n[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (curr[j - 1] ?? j) + 1,
        (prev[j] ?? i) + 1,
        (prev[j - 1] ?? i - 1) + cost,
      );
    }
    prev = curr;
  }
  const dist = prev[lenN] ?? Math.max(lenH, lenN);
  const maxLen = Math.max(lenH, lenN);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

/** Minimum score threshold to include a result (avoids noise). */
const SCORE_THRESHOLD = 0.3;

function keep(title: string, subtitle: string | undefined, q: string): number {
  const s = Math.max(
    fuzzyScore(title, q),
    subtitle ? fuzzyScore(subtitle, q) : 0,
  );
  return s;
}

// ---------------------------------------------------------------------------
// Entity-specific Prisma queries
// ---------------------------------------------------------------------------

async function searchVaults(q: string): Promise<SearchResult[]> {
  const rows = await prisma.vaultDeployment.findMany({
    where: {
      OR: [
        { ticker: { contains: q } },
        { name: { contains: q } },
        { strategy: { contains: q } },
        { status: { contains: q } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: MAX_PER_SECTION * 2,
    select: {
      id: true,
      ticker: true,
      name: true,
      strategy: true,
      status: true,
    },
  });

  return rows
    .map((r) => ({
      entity: "vault" as Entity,
      id: r.id,
      title: r.ticker,
      subtitle: r.name,
      badge: r.status,
      href: `/admin/vaults/${r.id}`,
      score: keep(r.ticker + " " + r.name, r.strategy, q),
    }))
    .filter((r) => r.score! >= SCORE_THRESHOLD)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, MAX_PER_SECTION);
}

async function searchInvestors(q: string): Promise<SearchResult[]> {
  const rows = await prisma.investor.findMany({
    where: {
      OR: [
        { walletAddress: { contains: q } },
        { email: { contains: q } },
        { kycStatus: { contains: q } },
        { user: { email: { contains: q } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: MAX_PER_SECTION * 2,
    select: {
      id: true,
      walletAddress: true,
      email: true,
      kycStatus: true,
      user: { select: { email: true } },
    },
  });

  return rows
    .map((r) => {
      const displayEmail = r.email ?? r.user.email;
      const title = r.walletAddress
        ? `${r.walletAddress.slice(0, 8)}…${r.walletAddress.slice(-4)}`
        : displayEmail ?? r.id;
      return {
        entity: "investor" as Entity,
        id: r.id,
        title,
        subtitle: displayEmail ?? undefined,
        badge: r.kycStatus,
        href: `/admin/investors/${r.id}`,
        score: keep(title, displayEmail ?? undefined, q),
      };
    })
    .filter((r) => r.score! >= SCORE_THRESHOLD)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, MAX_PER_SECTION);
}

async function searchPositions(q: string): Promise<SearchResult[]> {
  const rows = await prisma.position.findMany({
    where: {
      OR: [
        { id: { contains: q } },
        { vaultKey: { contains: q } },
        { status: { contains: q } },
        { investor: { walletAddress: { contains: q } } },
      ],
    },
    orderBy: { subscribedAt: "desc" },
    take: MAX_PER_SECTION * 2,
    select: {
      id: true,
      vaultKey: true,
      principalUsdc: true,
      status: true,
      investor: { select: { walletAddress: true, email: true } },
    },
  });

  return rows
    .map((r) => {
      const wallet = r.investor.walletAddress;
      const subtitle = wallet
        ? `${wallet.slice(0, 8)}…${wallet.slice(-4)}`
        : (r.investor.email ?? undefined);
      return {
        entity: "position" as Entity,
        id: r.id,
        title: `${r.vaultKey} — $${Number(r.principalUsdc).toLocaleString()}`,
        subtitle,
        badge: r.status,
        href: `/admin/positions/${r.id}`,
        score: keep(r.vaultKey, subtitle, q),
      };
    })
    .filter((r) => r.score! >= SCORE_THRESHOLD)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, MAX_PER_SECTION);
}

async function searchDistributions(q: string): Promise<SearchResult[]> {
  const rows = await prisma.distribution.findMany({
    where: {
      OR: [
        { id: { contains: q } },
        { period: { contains: q } },
        { txHash: { contains: q } },
        { vaultRef: { contains: q } },
      ],
    },
    orderBy: { distributedAt: "desc" },
    take: MAX_PER_SECTION * 2,
    select: {
      id: true,
      period: true,
      amountUsdc: true,
      txHash: true,
      vaultRef: true,
    },
  });

  return rows
    .map((r) => ({
      entity: "distribution" as Entity,
      id: r.id,
      title: `Distribution ${r.period}`,
      subtitle: `$${Number(r.amountUsdc).toLocaleString()} USDC`,
      badge: r.vaultRef ?? undefined,
      href: `/admin/distributions/${r.id}`,
      score: keep(`Distribution ${r.period}`, r.txHash ?? undefined, q),
    }))
    .filter((r) => r.score! >= SCORE_THRESHOLD)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, MAX_PER_SECTION);
}

async function searchProofs(q: string): Promise<SearchResult[]> {
  const rows = await prisma.proof.findMany({
    where: {
      OR: [
        { id: { contains: q } },
        { proofType: { contains: q } },
        { period: { contains: q } },
        { hash: { contains: q } },
        { txHash: { contains: q } },
      ],
    },
    orderBy: { postedAt: "desc" },
    take: MAX_PER_SECTION * 2,
    select: {
      id: true,
      proofType: true,
      period: true,
      hash: true,
      txHash: true,
    },
  });

  return rows
    .map((r) => ({
      entity: "proof" as Entity,
      id: r.id,
      title: `${r.proofType}${r.period ? ` — ${r.period}` : ""}`,
      subtitle: `${r.hash.slice(0, 10)}…`,
      badge: r.proofType,
      href: `/proof-center/${r.id}`,
      score: keep(r.proofType, r.period ?? undefined, q),
    }))
    .filter((r) => r.score! >= SCORE_THRESHOLD)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, MAX_PER_SECTION);
}

async function searchSignatures(q: string): Promise<SearchResult[]> {
  const rows = await prisma.proposalSignature.findMany({
    where: {
      OR: [
        { id: { contains: q } },
        { signerAddress: { contains: q } },
        { decision: { contains: q } },
      ],
    },
    orderBy: { signedAt: "desc" },
    take: MAX_PER_SECTION * 2,
    select: {
      id: true,
      signerAddress: true,
      decision: true,
      proposalId: true,
      signedAt: true,
    },
  });

  return rows
    .map((r) => {
      const short = `${r.signerAddress.slice(0, 8)}…${r.signerAddress.slice(-4)}`;
      return {
        entity: "signature" as Entity,
        id: r.id,
        title: `Sig ${short}`,
        subtitle: `Proposal ${r.proposalId.slice(0, 8)}…`,
        badge: r.decision,
        href: `/admin/governance/proposal/${r.proposalId}`,
        score: keep(r.signerAddress, r.decision, q),
      };
    })
    .filter((r) => r.score! >= SCORE_THRESHOLD)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, MAX_PER_SECTION);
}

async function searchScenarios(q: string): Promise<SearchResult[]> {
  const rows = await prisma.scenarioRun.findMany({
    where: {
      OR: [
        { id: { contains: q } },
        { preset: { contains: q } },
        { status: { contains: q } },
        { narrative: { contains: q } },
      ],
    },
    orderBy: { ranAt: "desc" },
    take: MAX_PER_SECTION * 2,
    select: {
      id: true,
      preset: true,
      status: true,
      ranAt: true,
      narrative: true,
    },
  });

  return rows
    .map((r) => ({
      entity: "scenario" as Entity,
      id: r.id,
      title: r.preset ?? `Scenario ${r.id.slice(0, 8)}`,
      subtitle: r.ranAt.toISOString().slice(0, 10),
      badge: r.status,
      href: `/scenario/${r.id}`,
      score: keep(r.preset ?? r.id, r.narrative ?? undefined, q),
    }))
    .filter((r) => r.score! >= SCORE_THRESHOLD)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, MAX_PER_SECTION);
}

async function searchBacktests(q: string): Promise<SearchResult[]> {
  const rows = await prisma.backtestRun.findMany({
    where: {
      OR: [
        { id: { contains: q } },
        { backtestKey: { contains: q } },
        { rulesMode: { contains: q } },
        { narrative: { contains: q } },
      ],
    },
    orderBy: { ranAt: "desc" },
    take: MAX_PER_SECTION * 2,
    select: {
      id: true,
      backtestKey: true,
      rulesMode: true,
      ranAt: true,
    },
  });

  return rows
    .map((r) => ({
      entity: "backtest" as Entity,
      id: r.id,
      title: r.backtestKey,
      subtitle: r.ranAt.toISOString().slice(0, 10),
      badge: r.rulesMode,
      href: `/scenario/backtest/${r.id}`,
      score: keep(r.backtestKey, r.rulesMode, q),
    }))
    .filter((r) => r.score! >= SCORE_THRESHOLD)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, MAX_PER_SECTION);
}

async function searchMemos(q: string): Promise<SearchResult[]> {
  const rows = await prisma.reportExport.findMany({
    where: {
      OR: [
        { id: { contains: q } },
        { clientName: { contains: q } },
        { methodologyVersion: { contains: q } },
      ],
    },
    orderBy: { generatedAt: "desc" },
    take: MAX_PER_SECTION * 2,
    select: {
      id: true,
      clientName: true,
      methodologyVersion: true,
      generatedAt: true,
    },
  });

  return rows
    .map((r) => ({
      entity: "memo" as Entity,
      id: r.id,
      title: `Memo — ${r.clientName}`,
      subtitle: r.generatedAt.toISOString().slice(0, 10),
      badge: r.methodologyVersion,
      href: `/memo/${r.id}`,
      score: keep(r.clientName, r.methodologyVersion, q),
    }))
    .filter((r) => r.score! >= SCORE_THRESHOLD)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, MAX_PER_SECTION);
}

async function searchEvents(q: string): Promise<SearchResult[]> {
  const rows = await prisma.rebalanceEvent.findMany({
    where: {
      OR: [
        { id: { contains: q } },
        { ruleId: { contains: q } },
        { status: { contains: q } },
        { triggerText: { contains: q } },
        { actionText: { contains: q } },
        { txHash: { contains: q } },
      ],
    },
    orderBy: { executedAt: "desc" },
    take: MAX_PER_SECTION * 2,
    select: {
      id: true,
      ruleId: true,
      triggerText: true,
      status: true,
      executedAt: true,
    },
  });

  return rows
    .map((r) => ({
      entity: "event" as Entity,
      id: r.id,
      title: `[${r.ruleId}] ${r.triggerText.slice(0, 60)}`,
      subtitle: r.executedAt.toISOString().slice(0, 10),
      badge: r.status,
      href: `/admin/events/${r.id}`,
      score: keep(r.ruleId + " " + r.triggerText, r.status, q),
    }))
    .filter((r) => r.score! >= SCORE_THRESHOLD)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, MAX_PER_SECTION);
}

// ---------------------------------------------------------------------------
// Direct-jump detection (address / tx hash / id prefix)
// ---------------------------------------------------------------------------

function detectDirectJump(
  q: string,
): { directJump: true; directHref: string } | { directJump: false } {
  const trimmed = q.trim();

  if (ADDRESS_RE.test(trimmed)) {
    return {
      directJump: true,
      directHref: `/admin/investors?wallet=${encodeURIComponent(trimmed)}`,
    };
  }

  if (TX_HASH_RE.test(trimmed)) {
    return {
      directJump: true,
      directHref: `/admin/events?txHash=${encodeURIComponent(trimmed)}`,
    };
  }

  for (const [prefix, entity] of Object.entries(ID_PREFIX_MAP)) {
    if (trimmed.startsWith(prefix)) {
      const entityRouteMap: Record<Entity, string> = {
        vault: "/admin/vaults",
        investor: "/admin/investors",
        position: "/admin/positions",
        distribution: "/admin/distributions",
        proof: "/proof-center",
        signature: "/admin/governance",
        scenario: "/scenario",
        backtest: "/scenario/backtest",
        memo: "/memo",
        event: "/admin/events",
      };
      return {
        directJump: true,
        directHref: `${entityRouteMap[entity]}/${encodeURIComponent(trimmed)}`,
      };
    }
  }

  return { directJump: false };
}

// ---------------------------------------------------------------------------
// Main exported index builder
// ---------------------------------------------------------------------------

export async function buildSearchIndex(
  query: string,
): Promise<SearchApiResponse> {
  const q = query.trim();

  // Direct-jump short-circuit
  const jump = detectDirectJump(q);
  if (jump.directJump) {
    return {
      results: [],
      query: q,
      directJump: true,
      directHref: jump.directHref,
    };
  }

  if (q.length < 1) {
    return { results: [], query: q, directJump: false };
  }

  // Fan-out queries in parallel
  const [
    vaults,
    investors,
    positions,
    distributions,
    proofs,
    signatures,
    scenarios,
    backtests,
    memos,
    events,
  ] = await Promise.all([
    searchVaults(q),
    searchInvestors(q),
    searchPositions(q),
    searchDistributions(q),
    searchProofs(q),
    searchSignatures(q),
    searchScenarios(q),
    searchBacktests(q),
    searchMemos(q),
    searchEvents(q),
  ]);

  const results = [
    ...vaults,
    ...investors,
    ...positions,
    ...distributions,
    ...proofs,
    ...signatures,
    ...scenarios,
    ...backtests,
    ...memos,
    ...events,
  ];

  return { results, query: q, directJump: false };
}
