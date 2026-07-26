import Link from "next/link";

import type { ProfilePageData } from "@/app/(product)/profile/_data/profile-loader";
import type { Wired, WhitelistStatus } from "@/lib/chain/dynavault";
import { abbreviateAddress } from "@/lib/onchain";
import { Button } from "@/ui";
import { DetailsList, type DetailsItem } from "@/ui/details-list";
import {
  PagePanel,
  PageSection,
  PageShell,
  PageTitle,
} from "@/ui/page-shell";
import { StatusValue, type StatusKind } from "@/ui/status-value";

/**
 * Identity & eligibility — reconstruite en greenfield.
 *
 * CE QUI A CHANGÉ, ET POURQUOI
 *  · Plus aucun `--ct-*` ni `admin-canon-*` : ces derniers ne sont définis que
 *    sous /admin et étaient donc INERTES ici (y compris `min-width: 0`).
 *  · La page n'est plus enfermée dans une grande carte contenant des cartes.
 *  · Les états métier ne sont plus des chaînes brutes du backend : une panne de
 *    service ne peut plus se lire comme un état du compte.
 *  · La provenance n'est plus « Live » écrit en dur — elle décrit la SOURCE.
 *  · Le titre disait « Documents & KYC » alors qu'aucun document n'est affiché.
 */

/** Le KYC du backend (verified|pending|incomplete|restricted) → état métier. */
function kycKind(status: string | undefined): StatusKind {
  switch (status) {
    case "verified":
      return "verified";
    case "pending":
      return "pending";
    case "incomplete":
      return "not-started";
    case "restricted":
      return "rejected";
    default:
      return "unknown";
  }
}

/**
 * Nomme la SOURCE d'un bloc, pas sa fraîcheur.
 * `provenance` est renseigné par la couche données (ex. « gpu1:/api/v1/profile »,
 * « db ») ; on ne fabrique jamais un libellé qu'elle n'a pas fourni.
 */
function sourceLabel(provenance: string | undefined): string {
  if (!provenance) return "Backend API";
  if (provenance.startsWith("db")) return "Database record";
  if (provenance.includes("/api/")) return "Backend API";
  if (provenance === "fixture") return "Sample data";
  return provenance;
}

export function ProfileView({
  data,
  whitelist,
  email,
  walletAddress,
}: {
  data: ProfilePageData;
  whitelist: Wired<WhitelistStatus>;
  email: string;
  walletAddress: string | null;
}) {
  if (data.state === "error") {
    return (
      <PageShell className="gap-6">
        <PageTitle
          title="Identity & eligibility"
          description="Your account, verification status and subscription eligibility."
        />
        <PageSection title="Identity verification">
          <PagePanel>
            <p className="text-sm text-muted">
              We couldn&apos;t reach the data. {data.detail}
            </p>
            <p className="hc-caption mt-2">
              This is a read failure on our side — it says nothing about the
              state of your account.
            </p>
          </PagePanel>
        </PageSection>
      </PageShell>
    );
  }

  const { profile } = data;

  // ── Identité ────────────────────────────────────────────────────────────
  const kycBlock = profile.kyc;
  const kycUnavailable =
    kycBlock.status === "UNAVAILABLE" || kycBlock.status === "ERROR";
  const kyc: StatusKind = kycUnavailable
    ? "unavailable"
    : kycKind(kycBlock.value?.status);
  const kycReason = kycBlock.error?.message ?? "the identity provider did not answer";

  // ── Contact ─────────────────────────────────────────────────────────────
  const contactEmail =
    profile.contact.status === "LIVE" && profile.contact.value
      ? profile.contact.value.email
      : email;

  // ── Éligibilité ─────────────────────────────────────────────────────────
  const whitelisted = whitelist.status === "wired" ? whitelist.data.whitelisted : null;

  const identityItems: DetailsItem[] = [
    {
      id: "kyc",
      label: "Identity verification",
      hint:
        kyc === "unavailable"
          ? "Last known state could not be read"
          : undefined,
      value: <StatusValue kind={kyc} reason={kycReason} />,
    },
  ];

  const eligibilityItems: DetailsItem[] = [
    {
      id: "wallet",
      label: "Linked wallet",
      value: walletAddress ? (
        <span className="tabular-nums">{abbreviateAddress(walletAddress)}</span>
      ) : (
        <StatusValue kind="not-linked" />
      ),
    },
    {
      id: "whitelist",
      label: "Subscription eligibility",
      hint: "Read directly from the vault contract",
      value:
        whitelisted === null ? (
          <StatusValue
            kind="unavailable"
            reason="the vault contract could not be read"
          />
        ) : (
          <StatusValue
            kind={whitelisted ? "verified" : "not-started"}
            label={whitelisted ? "Whitelisted" : "Not whitelisted"}
          />
        ),
    },
  ];

  const accountItems: DetailsItem[] = [
    {
      id: "email",
      label: "Email",
      // Normalisé en minuscules : une adresse e-mail est insensible à la casse,
      // l'afficher telle que saisie donne une incohérence d'une page à l'autre.
      value: <span className="break-all">{(contactEmail ?? "").toLowerCase()}</span>,
    },
    {
      id: "source",
      label: "Data source",
      hint: profile.contact.freshness,
      value: (
        <span className="text-muted">{sourceLabel(profile.contact.provenance)}</span>
      ),
    },
  ];

  // ── Actions : la page ne se contente pas de décrire des problèmes ────────
  const kycAction =
    kyc === "not-started" || kyc === "unknown" ? (
      <Link href="/onboarding/identity">
        <Button size="sm">Start verification</Button>
      </Link>
    ) : kyc === "pending" ? null : kyc === "unavailable" ? (
      <Link href="/support">
        <Button size="sm" variant="secondary">
          Contact support
        </Button>
      </Link>
    ) : null;

  const walletAction = walletAddress ? null : (
    <Link href="/onboarding/wallet">
      <Button size="sm" variant="secondary">
        Link a wallet
      </Button>
    </Link>
  );

  return (
    <PageShell className="gap-6">
      <PageTitle
        eyebrow="Series 1"
        title="Identity & eligibility"
        description="Your account, verification status and subscription eligibility."
      />

      <PageSection title="Identity verification" actions={kycAction}>
        <PagePanel flush>
          <DetailsList items={identityItems} />
        </PagePanel>
      </PageSection>

      <PageSection title="Wallet & eligibility" actions={walletAction}>
        <PagePanel flush>
          <DetailsList items={eligibilityItems} />
        </PagePanel>
      </PageSection>

      <PageSection title="Account">
        <PagePanel flush>
          <DetailsList items={accountItems} />
        </PagePanel>
      </PageSection>
    </PageShell>
  );
}
