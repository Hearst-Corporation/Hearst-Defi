"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { TokenIcon } from "@web3icons/react/dynamic";

import { cn } from "@/lib/cn";
import { manufacturerOf } from "@/lib/telegram/manufacturer-catalog";
import {
  CockpitButton as Button,
  cockpitButtonVariants,
} from "@/components/catalyst/cockpit-button";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { BentoHeader, BentoKpiStrip, BentoPanel } from "@/components/catalyst/bento";
import {
  CONSTRUCTION_STEPS,
  type ConstructionStepId,
  type ConstructionStepStatus,
  type ConstructionStreamFrame,
  type StepMetric,
} from "@/lib/agentic/swarm/live/stream-types";
import type { LiveProvenance, ProductConstructionDraft } from "@/lib/agentic/swarm/live/types";
import {
  constructionDraftToVaultForm,
  encodeVaultFormPrefill,
} from "@/lib/agentic/swarm/live/to-vault-form";
import { DataScientistOutput } from "./data-scientist-output";
import { ProductEngineReport } from "./product-engine-report";

/**
 * Product construction — full-page vertical stepper.
 *
 * The five named specialists run server-side, one real `await` each, and stream
 * an NDJSON frame per transition. This component reveals each step ONLY when its
 * frame actually arrives (no cosmetic 300ms timer) and auto-scrolls to the active
 * step as the construction advances. Token-only (`--ct-*`), Catalyst atoms, dark.
 * Read-only: nothing is created, sent, or deployed from here.
 */

/**
 * DISPLAY-ONLY mask — which step cards are rendered in the stepper.
 *
 * The five specialists ALWAYS run server-side and stream their frames; this list
 * only controls what the admin SEES. We are iterating the design step-by-step, so
 * we currently render step 1 (bitcoin) alone. Add ids back here to reveal the
 * others — nothing in the pipeline/computation changes.
 */
const VISIBLE_STEP_IDS: readonly ConstructionStepId[] = [
  "bitcoin",
  "hashprice",
  "mining_infra",
  "defi",
  "data_scientist",
];

/** Minimum on-screen "running" time per step (narration + search read as real). */
const MIN_STEP_MS = 5_000;

/** Delay before the view auto-scrolls to the next step, so the KPIs a step just
 *  produced stay readable for a beat before the page moves on. */
const SCROLL_ADVANCE_DELAY_MS = 2_000;

/**
 * Per-step LOADING config — the narration that types out while the specialist
 * works, plus how many source/asset placeholders to show. Logos are placeholders
 * for now (real brand assets wired later, like step 1's bitcoin/coingecko/etc.).
 * `mainLogo` is the big hero placeholder; `sourceCount` is the cross-checked row.
 */
type LoadingVisual =
  | { kind: "brand"; id: BrandId }
  | { kind: "placeholder"; label: string };

const STEP_LOADING: Record<
  ConstructionStepId,
  {
    narration: string;
    mainVisual: LoadingVisual;
    sourcesLabel: string;
    sources: readonly LoadingVisual[];
  }
> = {
  bitcoin: {
    narration:
      "Our Bitcoin Price Specialist finds the fairest BTC price and cross-checks several sources…",
    mainVisual: { kind: "brand", id: "bitcoin" },
    sourcesLabel: "Cross-sourced",
    sources: [
      { kind: "brand", id: "coingecko" },
      { kind: "brand", id: "binance" },
      { kind: "brand", id: "kraken" },
    ],
  },
  hashprice: {
    narration:
      "Our Hashprice Specialist derives the hashprice ($/TH/day) and network difficulty in real time…",
    mainVisual: { kind: "placeholder", label: "Hashprice" },
    sourcesLabel: "Network sources",
    sources: [
      { kind: "brand", id: "luxor" },
      { kind: "brand", id: "hashrateindex" },
      { kind: "brand", id: "mempool" },
    ],
  },
  mining_infra: {
    narration:
      "Our Mining Infrastructure Specialist prices the machines (landed cost: ex-works + freight + customs) and the margins…",
    mainVisual: { kind: "brand", id: "bitmain" },
    sourcesLabel: "Suppliers",
    sources: [
      { kind: "brand", id: "bitmain" },
      { kind: "brand", id: "microbt" },
      { kind: "brand", id: "canaan" },
    ],
  },
  defi: {
    narration:
      "Our DeFi Specialist sources the best stable / BTC yields and the BTC scenario band…",
    mainVisual: { kind: "brand", id: "morpho" },
    sourcesLabel: "Protocols",
    sources: [
      { kind: "brand", id: "morpho" },
      { kind: "brand", id: "aave" },
      { kind: "brand", id: "compound" },
    ],
  },
  data_scientist: {
    narration:
      "Our Data Scientist writes the thesis, plots the projection and sizes the allocation (+2 versions)…",
    mainVisual: { kind: "placeholder", label: "Model" },
    sourcesLabel: "Engines",
    sources: [
      { kind: "placeholder", label: "Quant" },
      { kind: "placeholder", label: "Charts" },
      { kind: "placeholder", label: "Write-up" },
    ],
  },
};

/**
 * Generic loading placeholder — a neutral round chip with a label initial, used
 * for the hero logo + the cross-checked sources row while real brand assets are
 * being chosen. Step 1 already uses real BrandLogos; the others use these until
 * we pick their logos.
 */
function StepLogoPlaceholder({ label, size = 28 }: { label: string; size?: number }) {
  const initials = label
    .split(/[\s./-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return (
    <span
      title={label}
      className="inline-flex shrink-0 items-center justify-center rounded-(--ct-radius-full) border border-[var(--ct-border)] bg-[var(--ct-surface-inset)] ct-text-muted"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initials || label.charAt(0).toUpperCase()}
    </span>
  );
}

type Lifecycle = "upcoming" | "running" | ConstructionStepStatus;

interface StepResult {
  status: ConstructionStepStatus;
  headline: string;
  metrics: StepMetric[];
  provenance: LiveProvenance | null;
  note?: string;
}

function liveToBadge(p: LiveProvenance): Provenance {
  switch (p) {
    case "Live": return "live";
    case "Oracle": return "oracle";
    case "Attested": return "attested";
    case "Estimated": return "estimated";
    case "Manual": return "manual";
    case "Stale": return "stale";
  }
}

/** Node visual tone derived from lifecycle. */
function nodeTone(life: Lifecycle): "accent" | "warning" | "danger" | "current" | "idle" {
  if (life === "running") return "current";
  if (life === "live") return "accent";
  if (life === "degraded" || life === "unavailable") return "warning";
  if (life === "error") return "danger";
  return "idle";
}

const CHECK = (
  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 12 12" fill="none">
    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function StepNode({
  life,
  pipelineRunning,
  isNextUp = false,
}: {
  life: Lifecycle;
  pipelineRunning: boolean;
  isNextUp?: boolean;
}) {
  const tone = nodeTone(life);
  const isComplete = tone === "accent" || tone === "warning" || tone === "danger";
  // The immediate next step's black ring spins while the pipeline works toward it
  // (the transition gap: previous step done, this one not yet started).
  const isLoadingNext = tone === "idle" && isNextUp;
  // Other queued nodes pulse softly while the pipeline is active.
  const isQueued = tone === "idle" && pipelineRunning && !isLoadingNext;
  return (
    <span
      aria-current={tone === "current" ? "step" : undefined}
      aria-label={isLoadingNext ? "loading" : undefined}
      role={isLoadingNext ? "status" : undefined}
      className={cn(
        "relative z-10 flex h-(--ct-space-8) w-(--ct-space-8) items-center justify-center rounded-(--ct-radius-full) transition-colors duration-300",
        tone === "accent" && "bg-[var(--ct-accent)] text-[var(--ct-bg-deep)]",
        tone === "warning" && "bg-[var(--ct-status-warning)] text-[var(--ct-bg-deep)]",
        tone === "danger" && "bg-[var(--ct-status-danger)] text-[var(--ct-bg-deep)]",
        tone === "current" && "bg-surface-page",
        tone === "idle" && !isLoadingNext && "border border-[var(--ct-border-soft)] bg-surface-page",
        // Next-up: the black ring itself becomes a spinning accent-topped loader.
        isLoadingNext && "animate-spin border-2 border-[var(--ct-border-soft)] border-t-[var(--ct-accent)] bg-surface-page",
      )}
    >
      {tone === "danger" ? (
        <span className="mono text-[length:var(--ct-text-sm)] font-bold">!</span>
      ) : isComplete ? (
        CHECK
      ) : tone === "current" ? (
        // Spinning arc — accent arc over a faint track.
        <span
          aria-label="loading"
          role="status"
          className="h-(--ct-space-6) w-(--ct-space-6) animate-spin rounded-(--ct-radius-full) border-2 border-[var(--ct-border-soft)] border-t-[var(--ct-accent)]"
        />
      ) : isLoadingNext ? (
        // The black ring itself spins — no inner dot.
        null
      ) : isQueued ? (
        // Queued: pulsing dot — "I'm next in line."
        <span className="h-(--ct-space-2) w-(--ct-space-2) animate-pulse rounded-(--ct-radius-full) bg-[var(--ct-text-faint)]" />
      ) : (
        <span className="h-(--ct-space-2) w-(--ct-space-2) rounded-(--ct-radius-full) bg-[var(--ct-text-faint)] opacity-[var(--ct-opacity-40)]" />
      )}
    </span>
  );
}

/**
 * Typewriter — reveals `text` character by character while the step is running.
 * Purely visual (the real work runs server-side). Restarts when `text` changes.
 */
function Typewriter({ text, speedMs = 28 }: { text: string; speedMs?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    // Intentional: restart the reveal from 0 whenever `text` changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown(0);
    if (!text) return;
    const id = setInterval(() => {
      setShown((n) => {
        if (n >= text.length) {
          clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, speedMs);
    return () => clearInterval(id);
  }, [text, speedMs]);
  const done = shown >= text.length;
  return (
    <span>
      {text.slice(0, shown)}
      {!done ? (
        <span aria-hidden className="ct-text-accent animate-pulse">▍</span>
      ) : null}
    </span>
  );
}

/**
 * Brand logos — real downloaded official assets in /public/sources, rendered at
 * original colours (never tinted) inside a neutral round chip.
 */
type BrandId =
  | "bitcoin"
  | "coingecko"
  | "binance"
  | "kraken"
  | "usdc"
  | "aave"
  | "compound"
  | "morpho"
  | "ethena"
  | "bitmain"
  | "microbt"
  | "canaan"
  | "bitdeer"
  | "bitaxe"
  | "luxor"
  | "hashrateindex"
  | "mempool";

const BRAND_LOGOS: Record<BrandId, { label: string; src: string; lightChip?: boolean }> = {
  // Official square icon marks (vector SVG) so all four match in the round chips.
  bitcoin: { label: "Bitcoin", src: "/sources/bitcoin.svg" },
  coingecko: { label: "CoinGecko", src: "/sources/coingecko.svg" },
  binance: { label: "Binance", src: "/sources/binance.svg" },
  kraken: { label: "Kraken", src: "/sources/kraken.svg" },
  usdc: { label: "USDC", src: "/sources/usdc.svg" },
  aave: { label: "Aave", src: "/sources/aave.svg" },
  compound: { label: "Compound", src: "/sources/compound.svg" },
  morpho: { label: "Morpho", src: "/sources/morpho.svg" },
  ethena: { label: "Ethena", src: "/sources/ethena.svg" },
  bitmain: { label: "Bitmain", src: "/manufacturers/bitmain.png", lightChip: true },
  microbt: { label: "MicroBT", src: "/manufacturers/microbt.png", lightChip: true },
  canaan: { label: "Canaan", src: "/manufacturers/canaan.png", lightChip: true },
  bitdeer: { label: "Bitdeer", src: "/manufacturers/bitdeer.png", lightChip: true },
  bitaxe: { label: "Bitaxe", src: "/manufacturers/bitaxe.png", lightChip: true },
  luxor: { label: "Luxor", src: "/sources/luxor.png", lightChip: true },
  hashrateindex: { label: "Hashrate Index", src: "/sources/hashrateindex.png", lightChip: true },
  mempool: { label: "mempool.space", src: "/sources/mempool.svg" },
};

/**
 * Crypto TOKENS rendered from the official `@web3icons/react` set (branded logos),
 * keyed by their BrandId. Only real tokens live here — company/brand marks
 * (exchanges, data providers, miner manufacturers, mining pools) keep their
 * `/sources/*` asset via {@link BRAND_LOGOS} and are NOT in this map.
 *
 * `symbol` covers the tokens indexed by @web3icons; `address`+`network` covers a
 * token addressed on-chain. `ethena` (ENA) and `morpho` are not yet in the
 * package's metadata at this version, so they carry no lookup key and fall back
 * to their official `/sources/*.svg` asset (see the `fallback` below) — the chip
 * still shows the real logo, never a broken/empty icon.
 */
type TokenSpec =
  | { symbol: string; address?: never; network?: never }
  | { symbol?: never; address: string; network: string }
  | { symbol?: never; address?: never; network?: never };

const CRYPTO_TOKENS: Partial<Record<BrandId, TokenSpec>> = {
  bitcoin: { symbol: "btc" },
  usdc: { symbol: "usdc" },
  aave: { symbol: "aave" },
  compound: { symbol: "comp" },
  // Not indexed by symbol in @web3icons — addressed on-chain.
  morpho: { address: "0x9994E35Db50125E0DF82e4c2dde62496CE330999", network: "ethereum" },
  // Not resolvable at this @web3icons version — falls back to /sources/ethena.svg.
  ethena: {},
};

/** Crypto token icon (branded) on the same neutral round chip as BrandLogo. */
function TokenChip({ id, size = 28 }: { id: BrandId; size?: number }) {
  const brand = BRAND_LOGOS[id];
  const spec = CRYPTO_TOKENS[id]!;
  const fallback = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={brand.src}
      alt={brand.label}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className="h-full w-full object-contain"
    />
  );
  return (
    <span
      title={brand.label}
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--ct-border)] bg-[var(--ct-surface-inset)]"
      style={{ width: size, height: size }}
    >
      {"symbol" in spec && spec.symbol ? (
        <TokenIcon symbol={spec.symbol} variant="branded" size={size} fallback={fallback} />
      ) : "address" in spec && spec.address ? (
        <TokenIcon
          address={spec.address}
          network={spec.network}
          variant="branded"
          size={size}
          fallback={fallback}
        />
      ) : (
        fallback
      )}
    </span>
  );
}

/** Brand logo on a neutral round chip — original colours, never tinted. Crypto
 *  TOKENS route to {@link TokenChip} (official @web3icons); company/brand marks
 *  keep their downloaded `/sources/*` asset. */
function BrandLogo({ id, size = 28 }: { id: BrandId; size?: number }) {
  if (id in CRYPTO_TOKENS) {
    return <TokenChip id={id} size={size} />;
  }
  const brand = BRAND_LOGOS[id];
  return (
    <span
      title={brand.label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--ct-border)]",
        brand.lightChip ? "bg-white" : "bg-[var(--ct-surface-inset)]",
      )}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={brand.src}
        alt={brand.label}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain"
      />
    </span>
  );
}

function LogoMetricValue({
  logoId,
  children,
}: {
  logoId?: BrandId | null;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-(--ct-space-2)">
      {logoId ? <BrandLogo id={logoId} size={20} /> : null}
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
    </span>
  );
}

function metricValue(metrics: StepMetric[], label: string): string {
  return (
    metrics.find((m) => m.label.toLowerCase() === label.toLowerCase())?.value ?? ""
  );
}

function brandForDefiSource(source: string): BrandId | null {
  const normalized = source.toLowerCase();
  if (normalized.includes("morpho")) return "morpho";
  if (normalized.includes("aave")) return "aave";
  if (normalized.includes("compound") || normalized.includes("comp")) return "compound";
  if (normalized.includes("ethena")) return "ethena";
  return null;
}

function brandForManufacturer(model: string): BrandId | null {
  if (!model || model === "—") return null;
  const manufacturer = manufacturerOf(model);
  switch (manufacturer) {
    case "bitmain":
      return "bitmain";
    case "microbt":
      return "microbt";
    case "canaan":
      return "canaan";
    case "bitdeer":
      return "bitdeer";
    case "bitaxe":
      return "bitaxe";
    default:
      return null;
  }
}

function renderLoadingVisual(visual: LoadingVisual, size?: number) {
  return visual.kind === "brand" ? (
    <BrandLogo id={visual.id} size={size} />
  ) : (
    <StepLogoPlaceholder label={visual.label} size={size} />
  );
}

/**
 * Bitcoin step result — a KPI strip tailored to the Bitcoin Price Specialist:
 *  - Spot   : the Bitcoin logo next to the price.
 *  - 24h    : the % with an up/down arrow (accent up, danger down).
 *  - Source : the three cross-checked source logos (not text).
 */
function BitcoinResultStrip({ metrics }: { metrics: StepMetric[] }) {
  const spot = metricValue(metrics, "Spot");
  const change = metricValue(metrics, "24h");
  // Parse the signed % to pick the arrow + tone. "+1.2%" → up, "-0.8%" → down.
  const pctNum = parseFloat(change.replace(/[^0-9.+-]/g, ""));
  const up = Number.isFinite(pctNum) ? pctNum >= 0 : true;

  return (
    <BentoKpiStrip
      ariaLabel="Bitcoin price specialist output"
      items={[
        {
          label: "Spot",
          value: <LogoMetricValue logoId="bitcoin">{spot}</LogoMetricValue>,
        },
        {
          label: "24h",
          value: (
            <span
              className={cn(
                "inline-flex items-center gap-(--ct-space-1_5)",
                up ? "ct-text-accent" : "text-[var(--ct-status-danger)]",
              )}
            >
              <span>{up ? "↑" : "↓"}</span>
              <span>{change.replace(/^[+-]/, "")}</span>
            </span>
          ),
          accent: up,
        },
        {
          label: "Sources",
          value: (
            <span className="inline-flex items-center gap-(--ct-space-2)">
              <BrandLogo id="coingecko" size={20} />
              <BrandLogo id="binance" size={20} />
              <BrandLogo id="kraken" size={20} />
            </span>
          ),
        },
      ]}
    />
  );
}

/**
 * Generic step result strip — the FLAT KPI grammar (no rounded chip boxes): each
 * metric is a full-width cell (label on top, large fixed value below), cells
 * divided by thin vertical hairlines. Same grammar as the dashboard KPI tiles and
 * the Bitcoin strip, so every step reads identically — no boxes-in-boxes. The
 * Headline APY (data-scientist step) is the only accent-tinted value.
 */
function StepResultStrip({
  stepId,
  metrics,
}: {
  stepId: ConstructionStepId;
  metrics: StepMetric[];
}) {
  const items = metrics.map((metric) => {
    const labelLower = metric.label.toLowerCase();
    let value: React.ReactNode = metric.value;
    let accent = false;

    if (stepId === "mining_infra" && labelLower === "top by margin") {
      value = (
        <LogoMetricValue logoId={brandForManufacturer(metric.value)}>
          {metric.value}
        </LogoMetricValue>
      );
    } else if (stepId === "defi" && labelLower === "usdc yield") {
      value = <LogoMetricValue logoId="usdc">{metric.value}</LogoMetricValue>;
      accent = true;
    } else if (stepId === "defi" && labelLower === "source") {
      value = (
        <LogoMetricValue logoId={brandForDefiSource(metric.value)}>
          {metric.value}
        </LogoMetricValue>
      );
    } else if (stepId === "data_scientist" && labelLower === "headline apy") {
      accent = true;
    }

    return { label: metric.label, value, accent };
  });

  return (
    <BentoKpiStrip ariaLabel={`${stepId} specialist output`} items={items} />
  );
}

export function ConstructionStepper({ objective }: { objective: string | null }) {
  const [results, setResults] = useState<Partial<Record<ConstructionStepId, StepResult>>>({});
  const [current, setCurrent] = useState<ConstructionStepId | null>(null);
  const [draft, setDraft] = useState<ProductConstructionDraft | null>(null);
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  // Objective driving the run. Seeded from the URL/chat prop, but editable here so
  // the admin can trigger a construction straight from this page — no chat needed.
  const [objectiveInput, setObjectiveInput] = useState(objective ?? "");

  const autoRanRef = useRef(false);
  const nodeRefs = useRef(new Map<ConstructionStepId, HTMLLIElement>());

  const run = useCallback(async (rawObjective: string) => {
    const objective = rawObjective.trim();
    if (!objective) return;
    setResults({});
    setDraft(null);
    setError(null);
    setCurrent(null);
    setPhase("running");
    try {
      const res = await fetch("/api/admin/product-construction/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective }),
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `HTTP ${res.status}`);
        setPhase("error");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      // Each step must STAY visibly "running" for at least MIN_STEP_MS so the
      // narration types out and the search reads as real work — even when the
      // server resolves the data faster. We gate `step_done` on the elapsed time
      // since that step's `step_start`. The stream loop is sequential, so the
      // sleep naturally paces the whole pipeline.
      let stepStartedAt = Date.now();
      const sleep = (ms: number) =>
        new Promise<void>((r) => setTimeout(r, ms));
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let frame: ConstructionStreamFrame;
          try {
            frame = JSON.parse(line) as ConstructionStreamFrame;
          } catch {
            continue;
          }
          if (frame.type === "step_start") {
            stepStartedAt = Date.now();
            setCurrent(frame.step);
          } else if (frame.type === "step_done") {
            // Hold the running state until the step has been on screen ≥ minimum.
            const elapsed = Date.now() - stepStartedAt;
            if (elapsed < MIN_STEP_MS) await sleep(MIN_STEP_MS - elapsed);
            setResults((prev) => ({
              ...prev,
              [frame.step]: {
                status: frame.status,
                headline: frame.headline,
                metrics: frame.metrics,
                provenance: frame.provenance,
                ...(frame.note ? { note: frame.note } : {}),
              },
            }));
          } else if (frame.type === "final") {
            setDraft(frame.draft);
          } else if (frame.type === "error") {
            setError(frame.message);
          }
        }
      }
      setCurrent(null);
      setPhase((p) => (p === "error" ? "error" : "done"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "request failed");
      setPhase("error");
    }
  }, []);

  // Auto-run once when the workspace opens with an objective from the URL/chat.
  useEffect(() => {
    if (autoRanRef.current || !objective) return;
    autoRanRef.current = true;
    void run(objective);
  }, [objective, run]);

  // Auto-scroll to the active step as the construction advances — but DELAYED so
  // the just-finished step's KPIs stay on screen long enough to read before the
  // view moves on. Cleared on the next advance so it never double-fires.
  useEffect(() => {
    if (!current) return;
    const el = nodeRefs.current.get(current);
    const id = setTimeout(() => {
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, SCROLL_ADVANCE_DELAY_MS);
    return () => clearTimeout(id);
  }, [current]);

  // When the data-scientist draft lands, scroll to its (rich) output — also
  // delayed so the final KPI strip is readable before the jump.
  useEffect(() => {
    if (!draft) return;
    const el = nodeRefs.current.get("data_scientist");
    const id = setTimeout(() => {
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, SCROLL_ADVANCE_DELAY_MS);
    return () => clearTimeout(id);
  }, [draft]);

  const isRunning = phase === "running";
  const trimmedObjective = objectiveInput.trim();

  // Launcher — trigger a construction straight from this page (input + Run
  // button), no chat round-trip. Shown above the stepper; disabled while running.
  const launcher = (
    <form
      className="flex flex-wrap items-center gap-(--ct-space-3) border-b border-[var(--ct-border-soft)] p-(--ct-space-4)"
      onSubmit={(e) => {
        e.preventDefault();
        if (!isRunning && trimmedObjective) void run(trimmedObjective);
      }}
    >
      <label htmlFor="construction-objective" className="ct-bento-label shrink-0">
        Objective
      </label>
      <input
        id="construction-objective"
        type="text"
        value={objectiveInput}
        onChange={(e) => setObjectiveInput(e.target.value)}
        disabled={isRunning}
        maxLength={220}
        placeholder="e.g. Frame a new Hearst Yield Vault and project its APY range"
        className="min-w-0 flex-1 rounded-(--ct-radius-lg) border border-[var(--ct-border)] bg-surface-inset px-(--ct-space-3) py-(--ct-space-2) text-[length:var(--ct-text-sm)] ct-text-strong placeholder:ct-text-faint focus-visible:outline-none focus-visible:shadow-[var(--ct-shadow-focus-ring)] disabled:opacity-[var(--ct-opacity-50)]"
      />
      <Button type="submit" variant="primary" size="sm" disabled={isRunning || !trimmedObjective}>
        {isRunning ? "Running…" : draft || phase === "done" ? "Re-run projection" : "Run projection →"}
      </Button>
    </form>
  );

  // No objective anywhere yet (fresh page, no URL/chat seed): show ONLY the
  // launcher so the admin can start a construction without the chat.
  if (!objective && phase === "idle" && !draft) {
    return (
      <BentoPanel>
        {launcher}
        <p className="body-sm ct-text-muted p-(--ct-space-4)">
          Enter an objective and run — five specialists build a read-only draft from
          live data. Nothing is created, sent, or deployed here.
        </p>
      </BentoPanel>
    );
  }

  const lifecycleOf = (id: ConstructionStepId): Lifecycle => {
    if (results[id]) return results[id]!.status;
    if (current === id) return "running";
    return "upcoming";
  };

  return (
    <div className="flex flex-col gap-(--ct-space-6)">
      {/* Launcher — always available so a run can be (re)triggered from the page. */}
      <BentoPanel>{launcher}</BentoPanel>

      {/* Status bar removed (no value once each step renders its own state). A
          failure still surfaces so it is never silent. */}
      {error ? (
        <span className="text-[length:var(--ct-text-xs)] ct-status-danger">
          {error} ·{" "}
          <button
            type="button"
            onClick={() => void run(trimmedObjective || objective || "")}
            className="underline-offset-2 hover:underline"
          >
            retry
          </button>
        </span>
      ) : null}

      {/* Vertical stepper. `relative` so the continuous connector spine can be
          drawn at THIS level — outside every BentoPanel's overflow-hidden, which
          would otherwise clip a per-box line at the box border and stop it from
          crossing the inter-box gap. */}
      <ol className="relative flex flex-col">
        {/* Grey spine — one continuous line through every centered node. x = center
            of the left-rail column (half its width). Spans the full list height so
            it threads all centered nodes regardless of individual box heights. */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-(--ct-space-8) left-[calc((var(--ct-space-32)+var(--ct-space-8))/2)] w-px -translate-x-1/2 bg-[var(--ct-border-soft)]"
        />
        {CONSTRUCTION_STEPS.filter((s) => VISIBLE_STEP_IDS.includes(s.id)).map((step, i, visible) => {
          const life = lifecycleOf(step.id);
          const result = results[step.id];
          const isLast = i === visible.length - 1;
          const connectorDone = result !== undefined; // step finished → green segment
          // Next-up: the previous step is done and this one hasn't started yet —
          // its black ring spins during the transition gap.
          const prevDone = i > 0 && results[visible[i - 1]!.id] !== undefined;
          const isNextUp = phase === "running" && life === "upcoming" && prevDone;
          return (
            <li
              key={step.id}
              ref={(el) => {
                if (el) nodeRefs.current.set(step.id, el);
              }}
              className={cn("relative scroll-mt-(--ct-space-20)", !isLast && "pb-(--ct-space-8)")}
            >
              {/* Green connector — gap-crossing segment between this box and the
                  next. Lives at the <li> level so it escapes the panel's
                  overflow-hidden. Spans the full pb-(--ct-space-8) gap. */}
              {!isLast && connectorDone ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute bottom-0 left-[calc((var(--ct-space-32)+var(--ct-space-8))/2)] h-(--ct-space-8) w-px -translate-x-1/2 bg-[var(--ct-accent)]"
                />
              ) : null}
              {/* The step is a canonical DS compartment — BentoPanel (.ct-glass-panel).
                  A left RAIL inside the box holds the stepper node, centered. */}
              <BentoPanel>
                {/* Left rail compact on narrow containers (chat rail open), full
                    width only on wide. All widths from DS space tokens. */}
                <div className="grid grid-cols-[var(--ct-space-20)_minmax(0,1fr)] lg:grid-cols-[calc(var(--ct-space-32)+var(--ct-space-8))_minmax(0,1fr)]">
                  {/* Left rail — node centered. Green half-segments inside the card:
                      bottom half (node→bottom) when this step is done and not last;
                      top half (top→node) when the previous step is done. */}
                  <div className="relative flex items-center justify-center border-r border-[var(--ct-border-soft)]">
                    {/* Top half: green from top of card to node center */}
                    {i > 0 && results[visible[i - 1]!.id] !== undefined ? (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute top-0 left-1/2 w-px -translate-x-1/2 bg-[var(--ct-accent)]"
                        style={{ height: "50%" }}
                      />
                    ) : null}
                    {/* Bottom half: green from node center to bottom of card */}
                    {!isLast && connectorDone ? (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute bottom-0 left-1/2 w-px -translate-x-1/2 bg-[var(--ct-accent)]"
                        style={{ height: "50%" }}
                      />
                    ) : null}
                    <StepNode life={life} pipelineRunning={phase === "running"} isNextUp={isNextUp} />
                  </div>

                  {/* Right column — header + body */}
                  <div className="flex min-w-0 flex-col">
                    <BentoHeader
                      title={`${step.index}. ${step.persona}`}
                      subtitle={step.role}
                      trailing={
                        <>
                          {result?.provenance ? (
                            <ProvenanceBadge kind={liveToBadge(result.provenance)} compact />
                          ) : null}
                          {result?.status === "unavailable" ? (
                            <span className="ct-section-label ct-status-warning">unavailable</span>
                          ) : null}
                        </>
                      }
                    />
                    {result ? (
                      <>
                        <p className="body-sm ct-text-body p-(--ct-space-5) pb-(--ct-space-4)">
                          {result.headline}
                        </p>
                        {result.metrics.length > 0 ? (
                          step.id === "bitcoin" ? (
                            <BitcoinResultStrip metrics={result.metrics} />
                          ) : (
                            <StepResultStrip stepId={step.id} metrics={result.metrics} />
                          )
                        ) : null}
                        {result.note ? (
                          <p className="text-[length:var(--ct-text-xs)] ct-status-warning p-(--ct-space-5)">
                            {result.note}
                          </p>
                        ) : null}
                        {/* The Data Scientist's full report is NOT rendered inside
                            the stepper box — it unrolls as a separate, decorrelated
                            "Report Product" block below the stepper (see <ol> end). */}
                      </>
                    ) : life === "running" ? (
                      // Same loading layout / size / typewriter for EVERY step.
                      // Step 1 (bitcoin) uses real brand logos; the others use
                      // neutral placeholders until their logos are chosen.
                      // The loading block spans the WHOLE box (rail + content
                      // column) and centres its children exactly on the box: it
                      // breaks out over the left rail with a negative margin equal
                      // to the rail width AND widens by the same amount, so
                      // `items-center` lands dead-centre regardless of rail width.
                      // Both values track the responsive rail (compact --ct-space-20
                      // narrow → full --ct-space-32+8 at lg) so it never drifts.
                      <div className="flex flex-col items-center gap-(--ct-space-5) p-(--ct-space-6) ml-[calc(var(--ct-space-20)*-1)] w-[calc(100%+var(--ct-space-20))] lg:ml-[calc((var(--ct-space-32)+var(--ct-space-8))*-1)] lg:w-[calc(100%+var(--ct-space-32)+var(--ct-space-8))]">
                        {/* Hero logo */}
                        {renderLoadingVisual(STEP_LOADING[step.id].mainVisual, 72)}
                        {/* Narration — types out while the specialist searches. */}
                        <p className="max-w-prose text-center body-sm ct-text-secondary leading-relaxed">
                          <Typewriter text={STEP_LOADING[step.id].narration} />
                        </p>
                        {/* Cross-checked sources row */}
                        <div className="flex flex-col items-center gap-(--ct-space-2)">
                          <span className="ct-bento-label">{STEP_LOADING[step.id].sourcesLabel}</span>
                          <div className="flex items-center gap-(--ct-space-3)">
                            {STEP_LOADING[step.id].sources.map((source) => (
                              <span key={source.kind === "brand" ? source.id : source.label}>
                                {renderLoadingVisual(source)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-(--ct-space-5)" />
                    )}
                  </div>
                </div>
              </BentoPanel>
            </li>
          );
        })}
      </ol>

      {/* Report Product — the Data Scientist's full report, DECORRELATED from the
          stepper: once step 5 finishes, this unrolls as its own titled block below
          the stepper, not inside a step box. */}
      {draft ? (
        <BentoPanel>
          <BentoHeader
            title="Report Product"
            subtitle={draft.vault.label}
          />
          <div className="p-(--ct-space-5)">
            <DataScientistOutput draft={draft} />
            {/* PROMPT 17 — wired product financial engines (funding / exit-recovery
                / waterfalls / operator) + calculated-vs-documented disclosure.
                Renders nothing for a non-mining draft. */}
            <ProductEngineReport draft={draft} />
          </div>
        </BentoPanel>
      ) : null}

      {/* Handoffs — wizard prefill (no DB write) */}
      {draft ? (
        <div className="flex flex-wrap items-center gap-(--ct-space-3) border-t border-[var(--ct-border-soft)] pt-(--ct-space-4)">
          <Link
            href={`/admin/vaults/new?prefill=${encodeURIComponent(encodeVaultFormPrefill(constructionDraftToVaultForm(draft)))}`}
            className={cn(cockpitButtonVariants({ variant: "primary", size: "sm" }), "self-start")}
          >
            Open in vault wizard (pre-filled)
          </Link>
          <Button variant="ghost" size="sm" onClick={() => window.open("/admin/product-workspace/report/print", "_blank", "noopener")}>
            Print view
          </Button>
          <span className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
            No record created · Manual admin validation required
          </span>
        </div>
      ) : null}
    </div>
  );
}
