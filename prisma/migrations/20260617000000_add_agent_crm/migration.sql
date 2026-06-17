-- Migration: add agent CRM models
-- Adds: AgentTemplate, QualificationProfile, AgentMemory
-- Alters: UserAgentProfile (templateId FK)

-- ----------------------------------------------------------------------------
-- AgentTemplate — reusable persona library
-- ----------------------------------------------------------------------------
CREATE TABLE "AgentTemplate" (
    "id"              TEXT NOT NULL,
    "slug"            TEXT NOT NULL,
    "label"           TEXT NOT NULL,
    "description"     TEXT,
    "baseAgent"       TEXT NOT NULL DEFAULT 'cockpit-chat',
    "tone"            TEXT,
    "language"        TEXT,
    "verbosity"       TEXT,
    "systemAdditions" TEXT,
    "archived"        BOOLEAN NOT NULL DEFAULT false,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentTemplate_slug_key" ON "AgentTemplate"("slug");
CREATE INDEX "AgentTemplate_archived_idx" ON "AgentTemplate"("archived");

-- ----------------------------------------------------------------------------
-- UserAgentProfile — add templateId FK (column may already exist on fresh DBs
-- from an earlier push; guard with IF NOT EXISTS via a DO block)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'UserAgentProfile' AND column_name = 'templateId'
    ) THEN
        ALTER TABLE "UserAgentProfile" ADD COLUMN "templateId" TEXT;
    END IF;
END$$;

ALTER TABLE "UserAgentProfile"
    ADD CONSTRAINT "UserAgentProfile_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "AgentTemplate"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "UserAgentProfile_templateId_idx" ON "UserAgentProfile"("templateId");

-- ----------------------------------------------------------------------------
-- QualificationProfile — Typeform/manual onboarding answers
-- ----------------------------------------------------------------------------
CREATE TABLE "QualificationProfile" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT,
    "email"        TEXT,
    "source"       TEXT NOT NULL DEFAULT 'typeform',
    "platformType" TEXT,
    "aum"          TEXT,
    "fundsUsage"   TEXT,
    "yieldStatus"  TEXT,
    "yieldType"    TEXT,
    "vaultSize"    TEXT,
    "timeline"     TEXT,
    "firstName"    TEXT,
    "lastName"     TEXT,
    "phone"        TEXT,
    "website"      TEXT,
    "rawPayload"   JSONB,
    "submittedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualificationProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QualificationProfile_userId_key" ON "QualificationProfile"("userId");
CREATE INDEX "QualificationProfile_email_idx" ON "QualificationProfile"("email");

-- ----------------------------------------------------------------------------
-- AgentMemory — distilled facts per user/agent
-- ----------------------------------------------------------------------------
CREATE TABLE "AgentMemory" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "agentName"    TEXT NOT NULL DEFAULT 'cockpit-chat',
    "kind"         TEXT NOT NULL DEFAULT 'fact',
    "content"      TEXT NOT NULL,
    "source"       TEXT NOT NULL DEFAULT 'chat-distill',
    "sourceChatId" TEXT,
    "active"       BOOLEAN NOT NULL DEFAULT true,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentMemory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentMemory_userId_agentName_active_idx" ON "AgentMemory"("userId", "agentName", "active");
CREATE INDEX "AgentMemory_sourceChatId_idx" ON "AgentMemory"("sourceChatId");
