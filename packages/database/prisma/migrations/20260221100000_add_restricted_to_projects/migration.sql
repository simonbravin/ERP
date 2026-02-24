-- AlterTable: add restricted_to_projects to org_members (Phase 1: visibility by assigned projects)
-- When true and role is EDITOR/VIEWER: user only sees assigned projects and cannot access org Finance. OWNER/ADMIN/ACCOUNTANT ignore this flag.
ALTER TABLE "public"."org_members" ADD COLUMN IF NOT EXISTS "restricted_to_projects" BOOLEAN NOT NULL DEFAULT false;
