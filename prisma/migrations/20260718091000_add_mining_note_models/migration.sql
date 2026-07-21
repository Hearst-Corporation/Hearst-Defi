-- ============================================================================
-- ADD SERIES 1 MINING-NOTE MODELS — ADR-019 / PermissionedDynaVault v2.1
-- ----------------------------------------------------------------------------
-- Additive persistence for external-backend indexing of:
--   TakeProfitExecution
--   CurtailmentEvent
--   BtcAccumulationSnapshot
--
-- Legacy Distribution, DistributionLedgerEntry, DistributionApproval and Pcap
-- tables are intentionally retained for historical/admin compatibility.
--
-- PREPARED ONLY. This migration is not applied by M13.
-- ============================================================================

CREATE TABLE "TakeProfitExecution" (
    "id" TEXT NOT NULL,
    "vaultDeploymentId" TEXT NOT NULL,
    "tierIndex" INTEGER NOT NULL,
    "btcPriceUsd" DECIMAL(65,30) NOT NULL,
    "btcSoldSats" BIGINT NOT NULL,
    "usdcReceived" DECIMAL(65,30) NOT NULL,
    "monthIndex" INTEGER,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "txHash" TEXT,
    "blockNumber" BIGINT,
    "source" TEXT NOT NULL DEFAULT 'onchain',

    CONSTRAINT "TakeProfitExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CurtailmentEvent" (
    "id" TEXT NOT NULL,
    "vaultDeploymentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "monthIndex" INTEGER NOT NULL,
    "btcPriceUsd" DECIMAL(65,30) NOT NULL,
    "thresholdUsd" DECIMAL(65,30),
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "txHash" TEXT,
    "blockNumber" BIGINT,
    "source" TEXT NOT NULL DEFAULT 'onchain',

    CONSTRAINT "CurtailmentEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BtcAccumulationSnapshot" (
    "id" TEXT NOT NULL,
    "vaultDeploymentId" TEXT NOT NULL,
    "monthIndex" INTEGER,
    "hashrateTh" DECIMAL(65,30) NOT NULL,
    "btcEarnedSats" BIGINT NOT NULL,
    "totalBtcEarnedSats" BIGINT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "txHash" TEXT,
    "blockNumber" BIGINT,
    "source" TEXT NOT NULL DEFAULT 'onchain',

    CONSTRAINT "BtcAccumulationSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TakeProfitExecution_txHash_key"
    ON "TakeProfitExecution"("txHash");
CREATE INDEX "TakeProfitExecution_vaultDeploymentId_executedAt_idx"
    ON "TakeProfitExecution"("vaultDeploymentId", "executedAt");
CREATE INDEX "TakeProfitExecution_tierIndex_idx"
    ON "TakeProfitExecution"("tierIndex");

CREATE UNIQUE INDEX "CurtailmentEvent_txHash_key"
    ON "CurtailmentEvent"("txHash");
CREATE INDEX "CurtailmentEvent_vaultDeploymentId_occurredAt_idx"
    ON "CurtailmentEvent"("vaultDeploymentId", "occurredAt");
CREATE INDEX "CurtailmentEvent_kind_idx"
    ON "CurtailmentEvent"("kind");

CREATE UNIQUE INDEX "BtcAccumulationSnapshot_txHash_key"
    ON "BtcAccumulationSnapshot"("txHash");
CREATE INDEX "BtcAccumulationSnapshot_vaultDeploymentId_reportedAt_idx"
    ON "BtcAccumulationSnapshot"("vaultDeploymentId", "reportedAt");

ALTER TABLE "TakeProfitExecution"
    ADD CONSTRAINT "TakeProfitExecution_vaultDeploymentId_fkey"
    FOREIGN KEY ("vaultDeploymentId") REFERENCES "VaultDeployment"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CurtailmentEvent"
    ADD CONSTRAINT "CurtailmentEvent_vaultDeploymentId_fkey"
    FOREIGN KEY ("vaultDeploymentId") REFERENCES "VaultDeployment"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BtcAccumulationSnapshot"
    ADD CONSTRAINT "BtcAccumulationSnapshot_vaultDeploymentId_fkey"
    FOREIGN KEY ("vaultDeploymentId") REFERENCES "VaultDeployment"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TakeProfitExecution"
    ADD CONSTRAINT "TakeProfitExecution_source_check"
    CHECK ("source" IN ('onchain', 'manual'));
ALTER TABLE "TakeProfitExecution"
    ADD CONSTRAINT "TakeProfitExecution_values_check"
    CHECK (
        "tierIndex" >= 0
        AND "btcPriceUsd" > 0
        AND "btcSoldSats" >= 0
        AND "usdcReceived" >= 0
        AND ("monthIndex" IS NULL OR "monthIndex" >= 0)
    );

ALTER TABLE "CurtailmentEvent"
    ADD CONSTRAINT "CurtailmentEvent_kind_check"
    CHECK ("kind" IN ('triggered', 'lifted'));
ALTER TABLE "CurtailmentEvent"
    ADD CONSTRAINT "CurtailmentEvent_source_check"
    CHECK ("source" IN ('onchain', 'manual'));
ALTER TABLE "CurtailmentEvent"
    ADD CONSTRAINT "CurtailmentEvent_values_check"
    CHECK (
        "monthIndex" >= 0
        AND "btcPriceUsd" > 0
        AND ("thresholdUsd" IS NULL OR "thresholdUsd" >= 0)
    );

ALTER TABLE "BtcAccumulationSnapshot"
    ADD CONSTRAINT "BtcAccumulationSnapshot_source_check"
    CHECK ("source" IN ('onchain', 'manual'));
ALTER TABLE "BtcAccumulationSnapshot"
    ADD CONSTRAINT "BtcAccumulationSnapshot_values_check"
    CHECK (
        ("monthIndex" IS NULL OR "monthIndex" >= 0)
        AND "hashrateTh" >= 0
        AND "btcEarnedSats" >= 0
        AND "totalBtcEarnedSats" >= "btcEarnedSats"
    );
