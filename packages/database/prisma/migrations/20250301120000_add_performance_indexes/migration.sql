-- Add indexes to speed up dashboard/projects/budget queries (optimization plan)
-- WbsNode: filter by projectId + active (e.g. budget actions)
CREATE INDEX "wbs_nodes_project_id_active_idx" ON "public"."wbs_nodes"("project_id", "active");

-- BudgetVersion: batch lookup by orgId + projectId + status (getApprovedOrBaselineBudgetTotals)
CREATE INDEX "budget_versions_org_id_project_id_status_idx" ON "public"."budget_versions"("org_id", "project_id", "status");

-- BudgetVersion: latest version per project (order by createdAt)
CREATE INDEX "budget_versions_org_id_project_id_created_at_idx" ON "public"."budget_versions"("org_id", "project_id", "created_at");
