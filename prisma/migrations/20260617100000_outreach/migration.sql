-- Migration: outreach platform (prospects, campaigns, tracked emails, events)

CREATE TABLE "OutreachProspect" (
    "id"               TEXT NOT NULL,
    "email"            TEXT NOT NULL,
    "firstName"        TEXT,
    "lastName"         TEXT,
    "company"          TEXT,
    "title"            TEXT,
    "source"           TEXT NOT NULL DEFAULT 'manual',
    "status"           TEXT NOT NULL DEFAULT 'new',
    "tags"             TEXT,
    "notes"            TEXT,
    "hubspotContactId" TEXT,
    "createdBy"        TEXT NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OutreachProspect_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OutreachProspect_email_key" ON "OutreachProspect"("email");
CREATE INDEX "OutreachProspect_status_idx" ON "OutreachProspect"("status");
CREATE INDEX "OutreachProspect_email_idx" ON "OutreachProspect"("email");

CREATE TABLE "OutreachCampaign" (
    "id"              TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "kind"            TEXT NOT NULL DEFAULT 'cold',
    "status"          TEXT NOT NULL DEFAULT 'draft',
    "fromEmail"       TEXT,
    "subjectTemplate" TEXT,
    "bodyTemplate"    TEXT,
    "includeTypeform" BOOLEAN NOT NULL DEFAULT true,
    "createdBy"       TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt"          TIMESTAMP(3),
    CONSTRAINT "OutreachCampaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OutreachCampaign_status_idx" ON "OutreachCampaign"("status");
CREATE INDEX "OutreachCampaign_kind_idx" ON "OutreachCampaign"("kind");

CREATE TABLE "OutreachEmail" (
    "id"             TEXT NOT NULL,
    "campaignId"     TEXT NOT NULL,
    "prospectId"     TEXT,
    "userId"         TEXT,
    "toEmail"        TEXT NOT NULL,
    "subject"        TEXT NOT NULL,
    "body"           TEXT NOT NULL,
    "status"         TEXT NOT NULL DEFAULT 'draft',
    "resendEmailId"  TEXT,
    "draftedByAgent" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt"     TIMESTAMP(3),
    "sentAt"         TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OutreachEmail_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OutreachEmail_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "OutreachCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutreachEmail_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "OutreachProspect"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OutreachEmail_resendEmailId_key" ON "OutreachEmail"("resendEmailId");
CREATE INDEX "OutreachEmail_campaignId_status_idx" ON "OutreachEmail"("campaignId", "status");
CREATE INDEX "OutreachEmail_toEmail_idx" ON "OutreachEmail"("toEmail");

CREATE TABLE "OutreachEmailEvent" (
    "id"         TEXT NOT NULL,
    "emailId"    TEXT NOT NULL,
    "type"       TEXT NOT NULL,
    "url"        TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw"        JSONB,
    CONSTRAINT "OutreachEmailEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OutreachEmailEvent_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "OutreachEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "OutreachEmailEvent_emailId_type_idx" ON "OutreachEmailEvent"("emailId", "type");
