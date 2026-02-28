-- DropIndex: commitment number unique per org; replace with unique per (org, project)
DROP INDEX IF EXISTS "commitments_org_id_commitment_number_key";

-- CreateIndex: commitment number unique per org and project
CREATE UNIQUE INDEX "commitments_org_id_project_id_commitment_number_key" ON "commitments"("org_id", "project_id", "commitment_number");
