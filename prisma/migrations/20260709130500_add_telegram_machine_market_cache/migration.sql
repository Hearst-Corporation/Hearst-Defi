-- Migration: persist Telegram machine market snapshots
-- Adds a DB-backed cache for machine pricing rows used by admin/source and portfolio.

CREATE TABLE IF NOT EXISTS "TelegramMachineMarketSnapshot" (
  "id" TEXT NOT NULL,
  "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "channel" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "listDate" TEXT,
  "hashpriceUsdPerThDay" DECIMAL(65,30) NOT NULL,
  "btcPriceUsd" DECIMAL(65,30) NOT NULL,
  "hashpriceStale" BOOLEAN NOT NULL DEFAULT false,
  "energyUsdPerKwh" DECIMAL(65,30) NOT NULL,
  "configured" BOOLEAN NOT NULL DEFAULT true,
  "error" TEXT,
  "source" TEXT NOT NULL DEFAULT 'telegram',
  CONSTRAINT "TelegramMachineMarketSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TelegramMachineMarketRow" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "manufacturer" TEXT NOT NULL,
  "cooling" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "thPerUnit" DECIMAL(65,30) NOT NULL,
  "efficiencyJTh" DECIMAL(65,30),
  "efficiencySource" TEXT NOT NULL,
  "exWorksUsd" DECIMAL(65,30) NOT NULL,
  "feesUsd" DECIMAL(65,30) NOT NULL,
  "landedUsd" DECIMAL(65,30) NOT NULL,
  "amortMonths" INTEGER NOT NULL,
  "capexUsdPerThDay" DECIMAL(65,30) NOT NULL,
  "energyUsdPerThDay" DECIMAL(65,30),
  "totalCostUsdPerThDay" DECIMAL(65,30),
  "marginUsdPerThDay" DECIMAL(65,30),
  CONSTRAINT "TelegramMachineMarketRow_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'TelegramMachineMarketRow_snapshotId_fkey'
  ) THEN
    ALTER TABLE "TelegramMachineMarketRow"
      ADD CONSTRAINT "TelegramMachineMarketRow_snapshotId_fkey"
      FOREIGN KEY ("snapshotId")
      REFERENCES "TelegramMachineMarketSnapshot"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "TelegramMachineMarketSnapshot_takenAt_idx"
  ON "TelegramMachineMarketSnapshot"("takenAt");

CREATE INDEX IF NOT EXISTS "TelegramMachineMarketSnapshot_channel_destination_takenAt_idx"
  ON "TelegramMachineMarketSnapshot"("channel", "destination", "takenAt");

CREATE INDEX IF NOT EXISTS "TelegramMachineMarketRow_snapshotId_idx"
  ON "TelegramMachineMarketRow"("snapshotId");
