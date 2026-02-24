-- CreateTable
CREATE TABLE "public"."document_folders" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "project_id" TEXT,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_folders_pkey" PRIMARY KEY ("id")
);

-- Add folder_id to documents
ALTER TABLE "public"."documents" ADD COLUMN IF NOT EXISTS "folder_id" TEXT;

-- CreateIndex
CREATE INDEX "document_folders_org_id_project_id_idx" ON "public"."document_folders"("org_id", "project_id");

-- CreateIndex
CREATE INDEX "document_folders_org_id_parent_id_idx" ON "public"."document_folders"("org_id", "parent_id");

-- CreateIndex
CREATE INDEX "documents_folder_id_idx" ON "public"."documents"("folder_id");

-- AddForeignKey (folder_id -> document_folders.id ON DELETE SET NULL)
ALTER TABLE "public"."documents" DROP CONSTRAINT IF EXISTS "documents_folder_id_fkey";
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "public"."document_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey document_folders org_id
ALTER TABLE "public"."document_folders" ADD CONSTRAINT "document_folders_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey document_folders project_id
ALTER TABLE "public"."document_folders" ADD CONSTRAINT "document_folders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey document_folders parent_id (self-reference)
ALTER TABLE "public"."document_folders" ADD CONSTRAINT "document_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."document_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
