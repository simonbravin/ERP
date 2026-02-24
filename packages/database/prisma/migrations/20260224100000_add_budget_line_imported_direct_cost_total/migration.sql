-- AlterTable
ALTER TABLE "public"."budget_lines" ADD COLUMN IF NOT EXISTS "imported_direct_cost_total" DECIMAL(15,2);
