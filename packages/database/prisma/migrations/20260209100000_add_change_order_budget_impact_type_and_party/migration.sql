-- AlterTable
ALTER TABLE "public"."change_orders" ADD COLUMN "budget_impact_type" TEXT NOT NULL DEFAULT 'DEVIATION';
ALTER TABLE "public"."change_orders" ADD COLUMN "party_id" TEXT;

-- CreateIndex
CREATE INDEX "change_orders_project_id_budget_impact_type_idx" ON "public"."change_orders"("project_id", "budget_impact_type");

-- AddForeignKey
ALTER TABLE "public"."change_orders" ADD CONSTRAINT "change_orders_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
