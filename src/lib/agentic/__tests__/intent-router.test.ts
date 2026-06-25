import { describe, expect, it } from "vitest";

import { classifyAgenticIntent } from "@/lib/agentic/intent-router";
import type { AgenticIntentDecision } from "@/lib/agentic/intent-router-types";

const r = (msg: string, ctx = {}) => classifyAgenticIntent(msg, ctx);

/** Invariant: a prohibited (dangerous/gated) decision is NEVER an allow_* policy
 *  and never carries a route to navigate to. */
function assertNeverPositiveAction(d: AgenticIntentDecision): void {
  if (d.prohibitedAutonomousAction) {
    expect(d.actionPolicy.startsWith("allow_")).toBe(false);
    expect(d.routeKey).toBeUndefined();
  }
}

// ---------------------------------------------------------------------------
// Navigation — positive
// ---------------------------------------------------------------------------

describe("router — navigation positive", () => {
  it.each([
    ["go to vaults", "vaults"],
    ["ouvre les vaults", "vaults"],
    ["affiche les vaults", "vaults"],
    ["va dans le portefeuille", "portfolio"],
    ["ouvre le portefeuille", "portfolio"],
  ])("%s → navigation %s", (msg, routeKey) => {
    const d = r(msg);
    expect(d.kind).toBe("navigation");
    expect(d.actionPolicy).toBe("allow_navigation");
    expect(d.routeKey).toBe(routeKey);
    expect(d.requiresLLM).toBe(false);
    expect(d.prohibitedAutonomousAction).toBe(false);
    expect(d.requiresHumanGate).toBe(false);
  });

  it("open outreach → navigation admin-outreach", () => {
    const d = r("open outreach");
    expect(d.kind).toBe("navigation");
    expect(d.routeKey).toBe("admin-outreach");
  });

  it("dashboard → navigation (admin-dashboard for admin)", () => {
    expect(r("dashboard", { isAdmin: true }).routeKey).toBe("admin-dashboard");
    expect(r("dashboard").kind).toBe("navigation");
  });
});

// ---------------------------------------------------------------------------
// Navigation — negation (must NEVER navigate)
// ---------------------------------------------------------------------------

describe("router — navigation negated → cancellation, never navigate", () => {
  it.each([
    "je ne veux pas ouvrir le portefeuille",
    "ne va pas dans vaults",
    "n ouvre pas les vaults",
    "don't go to portfolio",
    "do not open outreach",
  ])("%s → cancellation, no route", (msg) => {
    const d = r(msg);
    expect(d.kind).toBe("cancellation");
    expect(d.negated).toBe(true);
    expect(d.routeKey).toBeUndefined();
    expect(d.actionPolicy.startsWith("allow_")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Education — read-only
// ---------------------------------------------------------------------------

describe("router — education read-only", () => {
  it.each([
    ["explique comment fonctionne le yield", "yield_explanation"],
    ["explique-moi comment fonctionne le yield", "yield_explanation"],
    ["comment marche le rendement", "yield_explanation"],
    ["c'est quoi le rendement", "yield_explanation"],
    ["how does yield work", "yield_explanation"],
    ["explique-moi comment marchent les produits", "product_explanation"],
    ["explique les produits Hearst", "product_explanation"],
    ["comment fonctionnent les produits", "product_explanation"],
    ["comment fonctionne un vault", "product_explanation"],
    ["c'est quoi un vault", "product_explanation"],
    ["quelle est la différence entre un produit et un vault", "product_explanation"],
    ["how do the products work", "product_explanation"],
    ["explain the products", "product_explanation"],
    ["what is a vault", "product_explanation"],
    ["explique les risques", "risk_explanation"],
    ["quels sont les risques d'un produit", "risk_explanation"],
    ["explique les risques d'un produit", "risk_explanation"],
  ])("%s → %s (read-only)", (msg, kind) => {
    const d = r(msg);
    expect(d.kind).toBe(kind);
    expect(d.actionPolicy).toBe("allow_readonly");
    expect(d.requiresHumanGate).toBe(false);
    expect(d.prohibitedAutonomousAction).toBe(false);
    expect(d.requiresCanvas).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Outreach
// ---------------------------------------------------------------------------

describe("router — outreach", () => {
  it("setup (vague) → outreach_setup, canvas", () => {
    const d = r(
      "lance une campagne outreach distributeurs institutionnels pour Hearst Yield",
    );
    expect(d.kind).toBe("outreach_setup");
    expect(d.actionPolicy).toBe("allow_canvas");
    expect(d.requiresCanvas).toBe(true);
    expect(d.canvasKey).toBe("outreach");
    expect(d.prohibitedAutonomousAction).toBe(false);
  });

  it("draft with fields → outreach_draft, HITL draft-only", () => {
    const d = r('crée un draft de campagne nommée "Distributeurs Q3", type cold');
    expect(d.kind).toBe("outreach_draft");
    expect(d.actionPolicy).toBe("allow_draft_only");
    expect(d.requiresHumanGate).toBe(true);
    expect(d.prohibitedAutonomousAction).toBe(false);
  });

  it("source → source_request, human-gated, prohibited autonomous", () => {
    const d = r("source des prospects");
    expect(d.kind).toBe("source_request");
    expect(d.actionPolicy).toBe("requires_human_gate");
    expect(d.requiresHumanGate).toBe(true);
    expect(d.prohibitedAutonomousAction).toBe(true);
    assertNeverPositiveAction(d);
  });

  it("send → send_request, human-gated, prohibited autonomous", () => {
    const d = r("envoie aux prospects");
    expect(d.kind).toBe("send_request");
    expect(d.requiresHumanGate).toBe(true);
    expect(d.prohibitedAutonomousAction).toBe(true);
    assertNeverPositiveAction(d);
  });

  it("send the campaign (EN) → send_request", () => {
    expect(r("send the campaign").kind).toBe("send_request");
  });
});

// ---------------------------------------------------------------------------
// Product / Vault
// ---------------------------------------------------------------------------

describe("router — product / vault", () => {
  it("crée un draft de vault → product_draft, canvas create-vault, HITL", () => {
    const d = r("crée un draft de vault");
    expect(d.kind).toBe("product_draft");
    expect(d.canvasKey).toBe("create-vault");
    expect(d.requiresHumanGate).toBe(true);
    expect(d.prohibitedAutonomousAction).toBe(false);
  });

  it("prépare un produit Hearst Yield → product_draft", () => {
    expect(r("prépare un produit Hearst Yield").kind).toBe("product_draft");
  });

  it("vérifie si ce vault est prêt → vault_readiness, read-only", () => {
    const d = r("vérifie si ce vault est prêt");
    expect(d.kind).toBe("vault_readiness");
    expect(d.actionPolicy).toBe("allow_readonly");
    expect(d.requiresHumanGate).toBe(false);
  });

  it("analyse la complétude du vault → vault_readiness", () => {
    expect(r("analyse la complétude du vault").kind).toBe("vault_readiness");
  });
});

// ---------------------------------------------------------------------------
// Dangerous intents — deploy / send / governance / migrate / change-core
// ---------------------------------------------------------------------------

describe("router — dangerous intents refused autonomous", () => {
  it.each([
    "mets ce vault en ligne",
    "déploie ce produit maintenant",
    "publie ce vault",
    "mark this vault live",
    "go live",
    "signe la transaction",
    "execute governance",
    "migrate database",
    "change formula",
    "change model",
  ])("%s → refused, prohibited, never allow_*", (msg) => {
    const d = r(msg);
    expect(d.kind).toBe("deploy_request");
    expect(["refuse_autonomous", "requires_human_gate"]).toContain(d.actionPolicy);
    expect(d.prohibitedAutonomousAction).toBe(true);
    expect(d.requiresHumanGate).toBe(true);
    expect(d.riskLevel).toBe("critical");
    expect(d.routeKey).toBeUndefined();
    assertNeverPositiveAction(d);
  });

  it("negated deploy → cancellation, never a deploy", () => {
    const d = r("ne déploie pas ce vault");
    expect(d.kind).toBe("cancellation");
    expect(d.prohibitedAutonomousAction).toBe(false);
    expect(d.actionPolicy.startsWith("allow_")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Confirmation / cancellation
// ---------------------------------------------------------------------------

describe("router — confirmation / cancellation", () => {
  it.each(["oui", "confirme", "confirm", "vas-y", "go", "ok"])(
    "%s → confirmation, requires existing pending action",
    (msg) => {
      const d = r(msg);
      expect(d.kind).toBe("confirmation");
      expect(d.requiresExistingPendingAction).toBe(true);
      expect(d.requiresHumanGate).toBe(true);
    },
  );

  it("bare confirmation with no pending gate says so in reason", () => {
    expect(r("oui", { hasPendingHumanGate: false }).reason).toMatch(/aucune action/i);
  });

  it.each(["annule", "cancel", "non", "stop"])("%s → cancellation", (msg) => {
    expect(r(msg).kind).toBe("cancellation");
  });

  it("go is confirmation, but 'go to vaults' is navigation (not confirm)", () => {
    expect(r("go").kind).toBe("confirmation");
    expect(r("go to vaults").kind).toBe("navigation");
  });
});

// ---------------------------------------------------------------------------
// Reporting + unknown
// ---------------------------------------------------------------------------

describe("router — reporting + unknown", () => {
  it("génère un brief → reporting_request read-only", () => {
    const d = r("génère un brief");
    expect(d.kind).toBe("reporting_request");
    expect(d.actionPolicy).toBe("allow_readonly");
  });

  it("empty → unknown", () => {
    expect(r("").kind).toBe("unknown");
    expect(r("   ").kind).toBe("unknown");
  });

  it("gibberish → unknown, delegated to LLM, no action", () => {
    const d = r("blah blah quux zorp");
    expect(d.kind).toBe("unknown");
    expect(d.requiresLLM).toBe(true);
    expect(d.prohibitedAutonomousAction).toBe(false);
    expect(d.routeKey).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Global safety invariant across a representative corpus
// ---------------------------------------------------------------------------

describe("router — global safety invariants", () => {
  const corpus = [
    "go to vaults",
    "ne va pas dans vaults",
    "explique comment fonctionne le yield",
    "déploie ce produit maintenant",
    "envoie aux prospects",
    "source des prospects",
    "mets ce vault en ligne",
    "crée un draft de vault",
    "oui",
    "annule",
  ];
  it("no decision ever pairs a prohibited flag with an allow_* policy or a route", () => {
    for (const msg of corpus) assertNeverPositiveAction(r(msg));
  });
});
