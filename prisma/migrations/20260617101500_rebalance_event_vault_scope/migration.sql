-- Migration: persist vault scope on RebalanceEvent
-- Adds nullable vaultRef for per-vault filtering on /admin/signals.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'RebalanceEvent' AND column_name = 'vaultRef'
    ) THEN
        ALTER TABLE "RebalanceEvent" ADD COLUMN "vaultRef" TEXT;
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS "RebalanceEvent_vaultRef_idx" ON "RebalanceEvent"("vaultRef");
