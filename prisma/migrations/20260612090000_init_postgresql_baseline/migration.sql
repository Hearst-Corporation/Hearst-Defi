-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "VaultSnapshot" (
    "id" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aumUsdc" DECIMAL(65,30) NOT NULL,
    "currentApyLow" DECIMAL(65,30) NOT NULL,
    "currentApyHigh" DECIMAL(65,30) NOT NULL,
    "stressedApy" DECIMAL(65,30) NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "miningMarginScore" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'computed',

    CONSTRAINT "VaultSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allocation" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "pct" DECIMAL(65,30) NOT NULL,
    "valueUsdc" DECIMAL(65,30) NOT NULL,
    "yieldContributionBps" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiningMetric" (
    "id" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hashprice" DECIMAL(65,30) NOT NULL,
    "difficulty" DECIMAL(65,30) NOT NULL,
    "btcPrice" DECIMAL(65,30) NOT NULL,
    "energyCost" DECIMAL(65,30) NOT NULL,
    "uptimePct" DECIMAL(65,30) NOT NULL,
    "deployedHashrate" DECIMAL(65,30) NOT NULL,
    "miningMarginScore" INTEGER NOT NULL,
    "hashpriceTrendPct" DECIMAL(65,30) NOT NULL,
    "operationalConfidence" INTEGER NOT NULL,
    "alertLevel" TEXT,
    "summary" TEXT,
    "recommendation" TEXT,

    CONSTRAINT "MiningMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioRun" (
    "id" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "preset" TEXT,
    "inputs" TEXT NOT NULL,
    "outputs" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "narrative" TEXT,
    "riskWarning" TEXT,
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "methodologyVersion" TEXT NOT NULL DEFAULT 'v1.0',

    CONSTRAINT "ScenarioRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestRun" (
    "id" TEXT NOT NULL,
    "backtestKey" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "initialCapital" DECIMAL(65,30) NOT NULL,
    "rulesMode" TEXT NOT NULL,
    "endingValue" DECIMAL(65,30) NOT NULL,
    "totalReturnPct" DECIMAL(65,30) NOT NULL,
    "maxDrawdownPct" DECIMAL(65,30) NOT NULL,
    "worstMonthPct" DECIMAL(65,30) NOT NULL,
    "numRebalances" INTEGER NOT NULL,
    "monthlySeries" TEXT NOT NULL,
    "narrative" TEXT,

    CONSTRAINT "BacktestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RebalanceEvent" (
    "id" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ruleId" TEXT NOT NULL,
    "triggerText" TEXT NOT NULL,
    "actionText" TEXT NOT NULL,
    "impactText" TEXT NOT NULL,
    "projection" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceEventName" TEXT,
    "sourceEventId" TEXT,
    "fromAllocation" TEXT NOT NULL,
    "toAllocation" TEXT NOT NULL,
    "txHash" TEXT,
    "approvedBy" TEXT NOT NULL,

    CONSTRAINT "RebalanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Distribution" (
    "id" TEXT NOT NULL,
    "distributedAt" TIMESTAMP(3) NOT NULL,
    "amountUsdc" DECIMAL(65,30) NOT NULL,
    "txHash" TEXT,
    "recipientsCount" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "vaultRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "Distribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributionApproval" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "signerWallet" TEXT NOT NULL,
    "totalUsdc" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DistributionApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proof" (
    "id" TEXT NOT NULL,
    "proofType" TEXT NOT NULL,
    "period" TEXT,
    "hash" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedBy" TEXT NOT NULL,
    "txHash" TEXT,
    "notes" TEXT,
    "signer" TEXT,
    "signature" TEXT,
    "payloadJson" TEXT,

    CONSTRAINT "Proof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportExport" (
    "id" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "scenariosIncluded" TEXT NOT NULL,
    "backtestsIncluded" TEXT NOT NULL,
    "methodologyVersion" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "content" TEXT,
    "userId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadmapValidation" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "validatedBy" TEXT,
    "validatedAt" TIMESTAMP(3),
    "notes" TEXT,
    "blockers" TEXT,
    "evidenceUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoadmapValidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemId" TEXT,
    "pathname" TEXT,
    "message" TEXT NOT NULL,
    "author" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CockpitChat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CockpitChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CockpitMessage" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'normal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CockpitMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'investor',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "totpSecret" TEXT,
    "totpEnabledAt" TIMESTAMP(3),
    "totpLastUsedStep" INTEGER,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT,
    "email" TEXT,
    "kycStatus" TEXT NOT NULL DEFAULT 'pending',
    "accreditationAttestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "vaultDeploymentId" TEXT,
    "vaultKey" TEXT NOT NULL DEFAULT 'hearst_yield_vault',
    "principalUsdc" DECIMAL(65,30) NOT NULL,
    "accruedYieldUsdc" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "distributedUsdc" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maturedAt" TIMESTAMP(3),
    "exitedAt" TIMESTAMP(3),
    "txHashOpen" TEXT,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorTransaction" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "positionId" TEXT,
    "type" TEXT NOT NULL,
    "amountUsdc" DECIMAL(65,30) NOT NULL,
    "txHash" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestorTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultDeployment" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "strategy" TEXT NOT NULL,
    "colorTag" TEXT NOT NULL DEFAULT 'accent',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "minTicketUsdc" DECIMAL(65,30) NOT NULL,
    "capacityUsdc" DECIMAL(65,30) NOT NULL,
    "mgmtFeeBps" INTEGER NOT NULL DEFAULT 100,
    "perfFeeBps" INTEGER NOT NULL DEFAULT 1000,
    "hurdleBps" INTEGER NOT NULL DEFAULT 0,
    "softLockupDays" INTEGER NOT NULL DEFAULT 60,
    "targetApyLowBps" INTEGER NOT NULL,
    "targetApyHighBps" INTEGER NOT NULL,
    "spvJurisdiction" TEXT NOT NULL,
    "shareClass" TEXT NOT NULL DEFAULT 'A',
    "regExemption" TEXT NOT NULL,
    "disclaimers" TEXT NOT NULL,
    "targetMiningBps" INTEGER NOT NULL,
    "targetBtcTacticalBps" INTEGER NOT NULL,
    "targetUsdcBaseBps" INTEGER NOT NULL,
    "targetStableReserveBps" INTEGER NOT NULL,
    "network" TEXT,
    "contractAddress" TEXT,
    "requiredSigners" INTEGER NOT NULL DEFAULT 2,
    "signersWhitelist" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "deployedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "seededFromStudyId" TEXT,

    CONSTRAINT "VaultDeployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultDeploymentApproval" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "signerWallet" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decision" TEXT NOT NULL,
    "reason" TEXT,

    CONSTRAINT "VaultDeploymentApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectionStudyRun" (
    "id" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "label" TEXT,
    "presetIds" TEXT NOT NULL,
    "matrixSize" INTEGER NOT NULL DEFAULT 1,
    "scenarioRunIds" TEXT NOT NULL,
    "methodologyVersion" TEXT NOT NULL DEFAULT 'v1.0',
    "summary" TEXT,
    "notes" TEXT,

    CONSTRAINT "ProjectionStudyRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAudit" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorWallet" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "diff" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "AdminAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAgentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "tone" TEXT,
    "language" TEXT,
    "verbosity" TEXT,
    "customInstructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAgentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminChatMode" (
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'normal',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminChatMode_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ReviewDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatId" TEXT,
    "contentMd" TEXT NOT NULL,
    "contentJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "formState" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceProposal" (
    "id" TEXT NOT NULL,
    "vaultDeploymentId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "calldata" TEXT,
    "justification" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "proposedBy" TEXT NOT NULL,
    "requiredSigners" INTEGER NOT NULL,
    "cancelQuorum" INTEGER NOT NULL DEFAULT 2,
    "timelockHours" INTEGER NOT NULL DEFAULT 48,
    "graceWindowDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3),
    "etaAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "GovernanceProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalSignature" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "signerAddress" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionHref" TEXT,
    "actionLabel" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agentName" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptHash" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "cacheCreationInputTokens" INTEGER,
    "cacheReadInputTokens" INTEGER,
    "systemPromptHash" TEXT,
    "latencyMs" INTEGER,
    "status" TEXT NOT NULL,
    "errorType" TEXT,
    "errorMessage" TEXT,
    "costUsd" DOUBLE PRECISION,
    "userId" TEXT,

    CONSTRAINT "LlmRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "sort" TEXT,
    "columns" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddressAllowlist" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "addedBy" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AddressAllowlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareClass" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "minTicket" DECIMAL(65,30) NOT NULL,
    "lockupDays" INTEGER NOT NULL,
    "mgmtFeeBps" INTEGER NOT NULL,
    "perfFeeBps" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "shareClassId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockupUntil" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributionLedgerEntry" (
    "id" TEXT NOT NULL,
    "distributionId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "amountUsdc" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DistributionLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pcap" (
    "id" TEXT NOT NULL,
    "distributionId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdfUrl" TEXT,
    "generatedFor" TEXT NOT NULL,

    CONSTRAINT "Pcap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "data" TEXT NOT NULL DEFAULT '{}',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycInquiry" (
    "inquiryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycInquiry_pkey" PRIMARY KEY ("inquiryId")
);

-- CreateTable
CREATE TABLE "SubscriptionEnvelope" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "documentUrl" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionEnvelope_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VaultSnapshot_takenAt_idx" ON "VaultSnapshot"("takenAt");

-- CreateIndex
CREATE INDEX "Allocation_snapshotId_idx" ON "Allocation"("snapshotId");

-- CreateIndex
CREATE INDEX "MiningMetric_takenAt_idx" ON "MiningMetric"("takenAt");

-- CreateIndex
CREATE INDEX "ScenarioRun_ranAt_idx" ON "ScenarioRun"("ranAt");

-- CreateIndex
CREATE INDEX "ScenarioRun_userId_ranAt_idx" ON "ScenarioRun"("userId", "ranAt");

-- CreateIndex
CREATE INDEX "ScenarioRun_userId_createdAt_idx" ON "ScenarioRun"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BacktestRun_backtestKey_idx" ON "BacktestRun"("backtestKey");

-- CreateIndex
CREATE INDEX "BacktestRun_userId_createdAt_idx" ON "BacktestRun"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RebalanceEvent_executedAt_idx" ON "RebalanceEvent"("executedAt");

-- CreateIndex
CREATE INDEX "RebalanceEvent_status_triggeredAt_idx" ON "RebalanceEvent"("status", "triggeredAt");

-- CreateIndex
CREATE INDEX "Distribution_distributedAt_idx" ON "Distribution"("distributedAt");

-- CreateIndex
CREATE INDEX "Distribution_vaultRef_idx" ON "Distribution"("vaultRef");

-- CreateIndex
CREATE UNIQUE INDEX "Distribution_period_vaultRef_key" ON "Distribution"("period", "vaultRef");

-- CreateIndex
CREATE INDEX "DistributionApproval_period_idx" ON "DistributionApproval"("period");

-- CreateIndex
CREATE UNIQUE INDEX "DistributionApproval_period_signerWallet_key" ON "DistributionApproval"("period", "signerWallet");

-- CreateIndex
CREATE INDEX "Proof_proofType_period_idx" ON "Proof"("proofType", "period");

-- CreateIndex
CREATE INDEX "ReportExport_generatedAt_idx" ON "ReportExport"("generatedAt");

-- CreateIndex
CREATE INDEX "ReportExport_userId_generatedAt_idx" ON "ReportExport"("userId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapValidation_itemId_key" ON "RoadmapValidation"("itemId");

-- CreateIndex
CREATE INDEX "RoadmapValidation_status_idx" ON "RoadmapValidation"("status");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- CreateIndex
CREATE INDEX "Feedback_itemId_idx" ON "Feedback"("itemId");

-- CreateIndex
CREATE INDEX "Feedback_userId_createdAt_idx" ON "Feedback"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CockpitChat_userId_updatedAt_idx" ON "CockpitChat"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "CockpitMessage_chatId_createdAt_idx" ON "CockpitMessage"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "CockpitMessage_chatId_mode_idx" ON "CockpitMessage"("chatId", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Investor_userId_key" ON "Investor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Investor_walletAddress_key" ON "Investor"("walletAddress");

-- CreateIndex
CREATE INDEX "Investor_walletAddress_idx" ON "Investor"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Position_txHashOpen_key" ON "Position"("txHashOpen");

-- CreateIndex
CREATE INDEX "Position_investorId_status_idx" ON "Position"("investorId", "status");

-- CreateIndex
CREATE INDEX "Position_vaultDeploymentId_idx" ON "Position"("vaultDeploymentId");

-- CreateIndex
CREATE UNIQUE INDEX "InvestorTransaction_txHash_key" ON "InvestorTransaction"("txHash");

-- CreateIndex
CREATE INDEX "InvestorTransaction_investorId_occurredAt_idx" ON "InvestorTransaction"("investorId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "VaultDeployment_ticker_key" ON "VaultDeployment"("ticker");

-- CreateIndex
CREATE INDEX "VaultDeployment_status_idx" ON "VaultDeployment"("status");

-- CreateIndex
CREATE INDEX "VaultDeployment_strategy_status_idx" ON "VaultDeployment"("strategy", "status");

-- CreateIndex
CREATE INDEX "VaultDeploymentApproval_deploymentId_idx" ON "VaultDeploymentApproval"("deploymentId");

-- CreateIndex
CREATE UNIQUE INDEX "VaultDeploymentApproval_deploymentId_signerWallet_key" ON "VaultDeploymentApproval"("deploymentId", "signerWallet");

-- CreateIndex
CREATE INDEX "ProjectionStudyRun_ranAt_idx" ON "ProjectionStudyRun"("ranAt");

-- CreateIndex
CREATE INDEX "ProjectionStudyRun_createdBy_ranAt_idx" ON "ProjectionStudyRun"("createdBy", "ranAt");

-- CreateIndex
CREATE INDEX "AdminAudit_occurredAt_idx" ON "AdminAudit"("occurredAt");

-- CreateIndex
CREATE INDEX "AdminAudit_actorWallet_occurredAt_idx" ON "AdminAudit"("actorWallet", "occurredAt");

-- CreateIndex
CREATE INDEX "AdminAudit_entityType_entityId_idx" ON "AdminAudit"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "UserAgentProfile_userId_idx" ON "UserAgentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAgentProfile_userId_agentName_key" ON "UserAgentProfile"("userId", "agentName");

-- CreateIndex
CREATE INDEX "ReviewDocument_userId_createdAt_idx" ON "ReviewDocument"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "VaultDraft_userId_idx" ON "VaultDraft"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VaultDraft_userId_key" ON "VaultDraft"("userId");

-- CreateIndex
CREATE INDEX "GovernanceProposal_vaultDeploymentId_state_idx" ON "GovernanceProposal"("vaultDeploymentId", "state");

-- CreateIndex
CREATE INDEX "GovernanceProposal_state_idx" ON "GovernanceProposal"("state");

-- CreateIndex
CREATE INDEX "ProposalSignature_proposalId_idx" ON "ProposalSignature"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalSignature_proposalId_signerAddress_decision_key" ON "ProposalSignature"("proposalId", "signerAddress", "decision");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_category_idx" ON "Notification"("userId", "category");

-- CreateIndex
CREATE INDEX "LlmRun_createdAt_idx" ON "LlmRun"("createdAt");

-- CreateIndex
CREATE INDEX "LlmRun_agentName_idx" ON "LlmRun"("agentName");

-- CreateIndex
CREATE INDEX "LlmRun_status_idx" ON "LlmRun"("status");

-- CreateIndex
CREATE INDEX "LlmRun_userId_createdAt_idx" ON "LlmRun"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LlmRun_systemPromptHash_idx" ON "LlmRun"("systemPromptHash");

-- CreateIndex
CREATE INDEX "SavedView_userId_scope_idx" ON "SavedView"("userId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "AddressAllowlist_address_key" ON "AddressAllowlist"("address");

-- CreateIndex
CREATE INDEX "AddressAllowlist_active_category_idx" ON "AddressAllowlist"("active", "category");

-- CreateIndex
CREATE INDEX "ShareClass_vaultId_active_idx" ON "ShareClass"("vaultId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ShareClass_vaultId_code_key" ON "ShareClass"("vaultId", "code");

-- CreateIndex
CREATE INDEX "Subscription_userId_subscribedAt_idx" ON "Subscription"("userId", "subscribedAt");

-- CreateIndex
CREATE INDEX "Subscription_vaultId_status_idx" ON "Subscription"("vaultId", "status");

-- CreateIndex
CREATE INDEX "Subscription_shareClassId_idx" ON "Subscription"("shareClassId");

-- CreateIndex
CREATE INDEX "DistributionLedgerEntry_distributionId_idx" ON "DistributionLedgerEntry"("distributionId");

-- CreateIndex
CREATE INDEX "DistributionLedgerEntry_positionId_idx" ON "DistributionLedgerEntry"("positionId");

-- CreateIndex
CREATE INDEX "OnboardingProgress_userId_idx" ON "OnboardingProgress"("userId");

-- CreateIndex
CREATE INDEX "OnboardingProgress_path_idx" ON "OnboardingProgress"("path");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingProgress_userId_path_key" ON "OnboardingProgress"("userId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "KycEvent_inquiryId_key" ON "KycEvent"("inquiryId");

-- CreateIndex
CREATE INDEX "KycEvent_userId_receivedAt_idx" ON "KycEvent"("userId", "receivedAt");

-- CreateIndex
CREATE INDEX "KycInquiry_userId_idx" ON "KycInquiry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionEnvelope_envelopeId_key" ON "SubscriptionEnvelope"("envelopeId");

-- CreateIndex
CREATE INDEX "SubscriptionEnvelope_userId_createdAt_idx" ON "SubscriptionEnvelope"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SubscriptionEnvelope_envelopeId_idx" ON "SubscriptionEnvelope"("envelopeId");

-- CreateIndex
CREATE INDEX "SubscriptionEnvelope_status_idx" ON "SubscriptionEnvelope"("status");

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "VaultSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CockpitMessage" ADD CONSTRAINT "CockpitMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "CockpitChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investor" ADD CONSTRAINT "Investor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_vaultDeploymentId_fkey" FOREIGN KEY ("vaultDeploymentId") REFERENCES "VaultDeployment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorTransaction" ADD CONSTRAINT "InvestorTransaction_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorTransaction" ADD CONSTRAINT "InvestorTransaction_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultDeploymentApproval" ADD CONSTRAINT "VaultDeploymentApproval_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "VaultDeployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceProposal" ADD CONSTRAINT "GovernanceProposal_vaultDeploymentId_fkey" FOREIGN KEY ("vaultDeploymentId") REFERENCES "VaultDeployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalSignature" ADD CONSTRAINT "ProposalSignature_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "GovernanceProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareClass" ADD CONSTRAINT "ShareClass_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "VaultDeployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_shareClassId_fkey" FOREIGN KEY ("shareClassId") REFERENCES "ShareClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionLedgerEntry" ADD CONSTRAINT "DistributionLedgerEntry_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "Distribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

