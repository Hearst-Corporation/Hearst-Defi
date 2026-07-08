# Hearst × Zand Bank — Product & Partnership Brief

**Hearst Yield Vault — institutional distribution (B2B → B2B2C)**

Prepared for the Zand Bank demonstration — July 2026. Confidential. Not an offer or solicitation.

---

## 1. Executive summary

- Hearst manufactures an institutional, on-chain-verifiable USDC yield vault — the **Hearst Yield Vault**. Hearst operates **strictly B2B**: it never faces end-clients.
- Proposal: **Zand distributes the vault under its own licences** (CBUAE banking licence; VARA-approved digital-asset custody) through two channels:
  1. **Institutional clients** of Zand, who re-distribute the product to their own books;
  2. **Zand's direct clients** on its own platform (wealth shelf).
- Structures on the table:
  1. A **dedicated vault provisioned for Zand** at an agreed size, distributed inside the Zand platform;
  2. A **joint venture on the product** (co-branded vault, shared economics);
  3. An **exclusive distribution mandate**, with all client-facing distribution running through Zand and its licences.
- The platform is live today: account provisioning and onboarding (KYC-gated), subscription with institutional minimums, per-investor positions and statements, monthly USDC distribution runs with dual-control (two-signer) confirmation and a per-LP ledger, a Proof Center with public on-chain verification, and an operator console that a distributor's ops team can run.

## 2. The product — Hearst Yield Vault

- Single institutional USDC vault combining **three yield engines** in one wrapper:
  1. **Bitcoin mining cash-flow** — revenue-share agreements with operating mining farms; production data attested monthly and cryptographically anchored;
  2. **USDC base yield** — tokenised T-bills and institutional stable lending;
  3. **BTC tactical sleeve** — rule-based accumulation and profit-taking, sized by explicit rules.
- **Target net APY: 9.4–12.8% (range)**, inside a **stress envelope of 8–15%**. APY is always published as a range together with its stressed case — never a single point. Returns are **not guaranteed**.
- **Distributions: monthly, in USDC**, T+5 after epoch close.
- **Class A terms**: USD 250,000 minimum subscription · 60-day soft lock-up · 1% management + 10% performance fee with high-watermark.
- **Class B terms** (large allocators): USD 1,000,000 minimum · 90-day lock-up · 0.75% management + 8% performance.
- **Legal wrapper**: Cayman Exempted Limited Partnership (ELP). **Professional / qualified investors only** — no retail offering by Hearst.
- Product range on the same manufacturing framework: **Yield** (9.4–12.8% target) · **Defensive** (5–8% target) · **BTC Plus** (10–20% target). Each vault carries its own assumptions, share classes and provenance — no vault silently reuses another's numbers.

## 3. Verifiability — why "decentralised" is demonstrable, not declared

- **Smart-contract layer deployed and publicly verifiable today** on Base Sepolia (test-network pilot): an **ERC-4626 vault** (industry-standard share accounting; share token hyvUSDC, asset = USDC), an on-chain **Event Logger**, and a **Proof-of-Reserves Registry**. Contract addresses and deployment transactions are public on BaseScan — verification does not require trusting Hearst.
- **Mainnet deployment is deliberately gated** on a completed independent security audit and remediation. This is presented openly as governance discipline: a phased rollout, not a shortcut.
- **Provenance on every metric**: each number on the platform carries a badge — Live / Oracle / Attested / Estimated / Manual / Stale. The system refuses to display better provenance than it can prove.
- **Attestations anchored on-chain**: the keccak256 digest of each signed monthly mining attestation is the evidenceHash pinned in the on-chain PoR Registry — full continuity between the off-chain signed document and the on-chain proof.
- **Custody**: Fireblocks (institution-grade); read-only proof-of-reserves feed into the Proof Center.
- **Governance design**: multisig (Safe) + EIP-712 approvals + timelock; a separate guardian role can only pause the vault, never move funds.
- **No black-box automation**: rebalancing follows 8 explicit rules across 3 regimes (Defensive / Balanced / Opportunistic); every action is expressed as **Projection → Trigger → Action → Impact (PTAI)**, simulated before execution, and requires human multisig approval. The AI layer never executes financial or custodial actions.

## 4. The platform (what the demo shows)

**Client cockpit** — account activation → qualification / accreditation attestations → KYC → subscription checkout with term sheet → portfolio and position detail (value, yield history, distributions) → per-investor statements (PDF, provenance-stamped) → Proof Center → product assistant (AI chat with a server-side compliance guard: forbidden-claims filter, APY-as-range enforcement, read-only by design).

**Operator console** (the distribution back-office):
- Client CRM: create and provision accounts, generate activation links, KYC decisioning — every action written to an audit trail;
- Vault lifecycle: draft → review → dual-sign approval → live;
- Position deployment per client;
- Monthly distribution runs: pro-rata dry-run, then two-admin confirmation; per-LP ledger entries;
- Investor memo generation (with co-branding fields for a partner's name and logo);
- Immutable admin audit log and AI/agent observability (cost, latency, blocked outputs).

## 5. Distribution models (proposed sequencing)

- **Phase 1 — Omnibus (available now).** Zand subscribes as a single institutional LP (omnibus corporate account at an agreed size) and distributes internally to its clients under its own licences and suitability framework. No integration work required.
- **Phase 2 — Named sub-accounts (pilot).** Each end-client receives a provisioned account (Zand operator seat on the console): per-client positions, statements and a distribution ledger out of the box.
- **Phase 3 — JV / white-label + partner API (co-build roadmap).** Co-branded portal under Zand's brand, partner API (subscriptions, NAV, positions, statements), white-label investor memos (already a named roadmap item), revenue-share on fees. Scope, exclusivity and governance defined in the JV term sheet.
- In every phase, **Hearst remains the B2B manufacturer; Zand owns the client relationship** and distributes under the CBUAE/VARA umbrella.
- *Open legal point (to be confirmed by counsel): the licensing framework for distribution of a Cayman fund product to UAE investors (SCA promotion regime / qualified-investor exemptions / VARA scope).*

## 6. Why Zand × Hearst

**Zand** — first fully licensed all-digital UAE bank (CBUAE licence, June 2022); wholesale focus on corporates, institutions and government entities; VARA-approved institutional digital-asset custody (December 2024, onshore UAE HSMs); issuer of **AEDZ**, the first regulated AED stablecoin on public blockchains (CBUAE-approved, November 2025); partnerships with Chainlink, Ripple (RLUSD) and XDC; Fitch BBB+ (2025); SOC 2 Type II covering blockchain products (2026); **wealth management launch announced for Q1 2026**; publicly stated joint-venture playbook for GCC/Africa expansion.

**The fit:**
1. **Timing** — an alternative-yield product ready for the new wealth shelf at launch;
2. **Shared on-chain thesis** — Zand sells regulated digital-asset trust; Hearst manufactures provable yield (provenance badges, PoR, public contracts);
3. **Client match** — Zand's institutional and corporate base fits a USD 250k-minimum product;
4. **Rails** — monthly USDC distributions today; AEDZ subscription/distribution rails are a natural joint exploration (a yield vault distributable in a regulated dirham stablecoin);
5. **Compliance symmetry** — Zand: CBUAE / VARA / SOC 2 / ISO 27001-27701; Hearst: versioned methodology, audit-gated mainnet, human-in-the-loop controls, software-enforced language policy.

## 7. Compliance & risk framework (Hearst side)

- Published, versioned methodology (v1.0); every projection displays its assumptions; data-freshness checks (< 24h) feed a confidence score.
- Stress discipline: the stressed APY is always shown next to the target range; scenario analysis in PTAI format (bear market, mining-margin compression, extreme stress).
- Language policy enforced in software on every human-facing output: no "guarantee", "promise", "certain", "will deliver", "risk-free"; APY never as a single point.
- Offering restricted to professional / qualified investors via the Cayman ELP; distribution to UAE clients would run under Zand's licences and suitability obligations, subject to counsel confirmation per jurisdiction.

## 8. Proposed next steps

1. **Demo account handover** to Zand (sandboxed investor account on the live platform).
2. **Draft term sheet**: dedicated vault size, share-class terms, fee split / revenue share.
3. **Legal workstream**: UAE distribution qualification (CBUAE / SCA / VARA scope), Cayman ELP supplement for the partnership.
4. **Pilot**: omnibus subscription (Phase 1) while Phase 2 sub-account operations are set up.
5. **JV / exclusivity memorandum**: scope (UAE first; option on GCC/Africa as Zand expands), governance, co-branding.

---

*Projections are conditional on stated assumptions. Past performance does not guarantee future results. Hearst Yield Vault is offered exclusively to professional / qualified investors via a Cayman Exempted Limited Partnership. Subject to minimum subscription, soft lock-up, and jurisdictional restrictions. Not an offer or solicitation where prohibited.*
