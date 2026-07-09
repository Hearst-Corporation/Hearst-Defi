-- Document Vault backend persistence (hearst-docs-vault).
-- Owner-scoped by owner_id (userId). Additive only — creates 3 new tables,
-- touches no existing table. Safe to apply; NOT auto-applied to prod.

-- CreateTable
CREATE TABLE "document_vault_documents" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "project" TEXT,
    "source" TEXT NOT NULL DEFAULT 'agent',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "deck_json" JSONB NOT NULL,
    "thumbnail_url" TEXT,
    "slide_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_vault_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_vault_assets" (
    "id" TEXT NOT NULL,
    "project" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_vault_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_vault_events" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "event_type" TEXT NOT NULL,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_vault_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_vault_documents_owner_id_idx" ON "document_vault_documents"("owner_id");

-- CreateIndex
CREATE INDEX "document_vault_assets_project_idx" ON "document_vault_assets"("project");

-- CreateIndex
CREATE INDEX "document_vault_events_document_id_idx" ON "document_vault_events"("document_id");

-- AddForeignKey
ALTER TABLE "document_vault_events" ADD CONSTRAINT "document_vault_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document_vault_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
