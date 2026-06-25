-- CreateTable
CREATE TABLE "AgenticRouterDecisionTrace" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chatId" TEXT,
    "messageId" TEXT,
    "source" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actionPolicy" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "negated" BOOLEAN NOT NULL,
    "matchedRuleIds" JSONB NOT NULL,
    "routeKey" TEXT,
    "educationalKind" TEXT,
    "prohibitedAutonomousAction" BOOLEAN NOT NULL,
    "outcome" TEXT NOT NULL,
    "usedLegacyFallback" BOOLEAN NOT NULL,
    "tookFastPath" BOOLEAN NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "AgenticRouterDecisionTrace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgenticRouterDecisionTrace_createdAt_idx" ON "AgenticRouterDecisionTrace"("createdAt");

-- CreateIndex
CREATE INDEX "AgenticRouterDecisionTrace_kind_idx" ON "AgenticRouterDecisionTrace"("kind");

-- CreateIndex
CREATE INDEX "AgenticRouterDecisionTrace_outcome_idx" ON "AgenticRouterDecisionTrace"("outcome");

-- CreateIndex
CREATE INDEX "AgenticRouterDecisionTrace_actionPolicy_idx" ON "AgenticRouterDecisionTrace"("actionPolicy");

-- CreateIndex
CREATE INDEX "AgenticRouterDecisionTrace_negated_idx" ON "AgenticRouterDecisionTrace"("negated");

-- CreateIndex
CREATE INDEX "AgenticRouterDecisionTrace_routeKey_idx" ON "AgenticRouterDecisionTrace"("routeKey");

-- CreateIndex
CREATE INDEX "AgenticRouterDecisionTrace_chatId_idx" ON "AgenticRouterDecisionTrace"("chatId");
