-- AlterTable
ALTER TABLE "parties" ADD COLUMN IF NOT EXISTS "category" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "parties_org_id_category_idx" ON "parties"("org_id", "category");
