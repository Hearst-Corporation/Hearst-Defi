import Link from "next/link";

import { ActivationLinkButton } from "@/components/admin/customer/activation-link-button";
import { AgentAssignForm } from "@/components/admin/customer/agent-assign-form";
import { DeployPositionForm } from "@/components/admin/customer/deploy-position-form";
import { MemoryManager } from "@/components/admin/customer/memory-manager";
import { QualificationForm } from "@/components/admin/customer/qualification-form";
import { KycAction } from "@/components/admin/kyc-action";
import { FORM_SURFACE } from "@/components/admin/admin-page-shell";
import type { CustomerDetail } from "@/lib/data/customer-detail";
import type { AgentTemplate } from "@prisma/client";
import { formatAdminDate, formatUsdFull } from "@/lib/vaults/product-display";
import {
  Badge,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui";
import {
  PageHeader,
  PageLayout,
  Panel,
  Row,
  RowList,
  Section,
} from "@/views/_shared/layout";

const POSITION_STATUS_LABEL: Record<string, string> = {
  active: "Active",
  matured: "Matured",
  exited: "Exited",
};

const QUAL_SOURCE_LABEL: Record<string, string> = {
  typeform: "Typeform intake",
  self: "Self-serve application",
  manual: "Admin entry",
};

export function AdminCustomerDetailView({
  detail,
  templates,
}: {
  detail: CustomerDetail;
  templates: AgentTemplate[];
}) {
  const persona = detail.suggestedPersona;
  const applied = detail.agentProfile;

  return (
    <PageLayout>
      <PageHeader
        eyebrow={`Investor · ${detail.userId}`}
        title={detail.email}
        description="Identity, qualification, assistant settings, saved notes, and recent activity."
        actions={
          <KycAction
            investorId={detail.investorId}
            status={detail.kycStatus as "pending" | "approved" | "rejected"}
          />
        }
      />

      <p className="-mt-4 text-sm">
        <Link href="/admin/customers" className="text-accent-ink hover:underline">
          ← Investors
        </Link>
      </p>

      <Section title="Investor profile">
        <Panel>
          <RowList>
            <Row label="Email" value={detail.email} />
            <Row label="Role" value={detail.role} />
            <Row
              label="Wallet"
              value={
                <span className="font-mono text-xs">
                  {detail.walletAddress ?? "—"}
                </span>
              }
            />
            <Row label="Joined" value={formatAdminDate(detail.joinedAt)} />
          </RowList>
          <div className="border-t border-[var(--ct-border)] p-5">
            <p className="mb-3 text-xs leading-relaxed text-[var(--ct-text-muted)]">
              Account sign-in. Auto-created and admin-provisioned investors start
              with no usable password — they log in via a one-time activation link.
            </p>
            <ActivationLinkButton investorId={detail.investorId} />
          </div>
        </Panel>
      </Section>

      <Section title={`Vault positions (${detail.positions.length})`}>
        <Panel>
          {detail.positions.length === 0 ? (
            <EmptyState
              title="No positions on record"
              description="This investor has not yet subscribed to a vault position."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vault</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Subscribed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.positions.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm">{p.vaultKey}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {POSITION_STATUS_LABEL[p.status] ?? p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatUsdFull(p.principalUsdc)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-[var(--ct-text-muted)]">
                      {formatAdminDate(p.subscribedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      </Section>

      <Section
        title="Deploy position"
        description="Open an off-chain position for demo or pilot use. KYC must be approved first."
      >
        <Panel>
          <div className={FORM_SURFACE}>
            <DeployPositionForm
              investorId={detail.investorId}
              kycStatus={detail.kycStatus as "pending" | "approved" | "rejected"}
            />
          </div>
        </Panel>
      </Section>

      <Section
        title="Investor qualification"
        description={
          detail.qualification
            ? `Source: ${QUAL_SOURCE_LABEL[detail.qualification.source] ?? detail.qualification.source} · updated ${formatAdminDate(detail.qualification.updatedAt)}`
            : "No qualification profile on file yet."
        }
      >
        <Panel>
          <div className={FORM_SURFACE}>
            <QualificationForm
              investorId={detail.investorId}
              userId={detail.userId}
              profile={detail.qualification}
            />
          </div>
        </Panel>
      </Section>

      <Section title="Assistant settings">
        {persona ? (
          <Panel
            title="Recommended"
            description="Derived from the questionnaire answers by rule-based calibration (calibratePersona) — not a scoring model."
          >
            <RowList>
              <Row
                label="Segments"
                value={
                  <span className="text-accent-ink">
                    {persona.segments.join(", ") || "—"}
                  </span>
                }
              />
              <Row label="Style" value={persona.tone} />
              <Row label="Language" value={persona.language} />
              <Row label="Detail" value={persona.verbosity} />
              <Row label="Vault" value={persona.suggestedVault} />
            </RowList>
            <p className="border-t border-[var(--ct-border)] px-5 py-4 text-xs leading-relaxed text-[var(--ct-text-muted)]">
              {persona.customInstructions}
            </p>
          </Panel>
        ) : null}

        <Panel title="Current">
          {applied ? (
            <RowList>
              {applied.template ? (
                <Row
                  label="Preset"
                  value={
                    <span className="text-accent-ink">{applied.template.label}</span>
                  }
                />
              ) : null}
              <Row label="Style" value={applied.tone ?? "—"} />
              <Row label="Language" value={applied.language ?? "—"} />
              <Row label="Detail" value={applied.verbosity ?? "—"} />
            </RowList>
          ) : (
            <p className="px-5 py-4 text-sm text-[var(--ct-text-muted)]">
              No profile is applied yet. Refresh from intake answers or assign a
              reusable template.
            </p>
          )}
          {applied?.customInstructions ? (
            <p className="border-t border-[var(--ct-border)] px-5 py-4 text-xs leading-relaxed text-[var(--ct-text-muted)]">
              {applied.customInstructions}
            </p>
          ) : null}
          <div className="border-t border-[var(--ct-border)] p-5">
            <AgentAssignForm
              investorId={detail.investorId}
              userId={detail.userId}
              templates={templates}
              currentTemplateId={applied?.templateId ?? null}
              currentTemplate={applied?.template ?? null}
              canRecalibrate={detail.qualification !== null}
            />
          </div>
        </Panel>
      </Section>

      <Section title="Saved notes">
        <Panel>
          <div className={FORM_SURFACE}>
            <MemoryManager
              investorId={detail.investorId}
              userId={detail.userId}
              memory={detail.memory}
            />
          </div>
        </Panel>
      </Section>

      <Section
        title="Recent chat activity"
        description={
          detail.chatTotal > detail.chats.length
            ? `Showing the ${detail.chats.length} most recent of ${detail.chatTotal} conversations.`
            : `${detail.chatTotal} conversation${detail.chatTotal !== 1 ? "s" : ""} on record.`
        }
      >
        <Panel>
          {detail.chats.length === 0 ? (
            <EmptyState
              title="No chat activity yet"
              description="Investor conversations will appear here once a session has been opened."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Messages</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.chats.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="max-w-xs truncate">
                      {c.title ?? "(untitled)"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.messageCount}
                    </TableCell>
                    <TableCell className="text-right text-sm text-[var(--ct-text-muted)]">
                      {formatAdminDate(c.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      </Section>
    </PageLayout>
  );
}
