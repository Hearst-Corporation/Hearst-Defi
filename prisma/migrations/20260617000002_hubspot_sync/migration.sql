-- Migration: add HubSpotSync idempotency audit table

CREATE TABLE "HubSpotSync" (
    "id"              TEXT NOT NULL,
    "userId"          TEXT NOT NULL,
    "kind"            TEXT NOT NULL,
    "hubspotObjectId" TEXT,
    "sourceId"        TEXT,
    "syncedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HubSpotSync_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HubSpotSync_userId_kind_sourceId_idx" ON "HubSpotSync"("userId", "kind", "sourceId");
