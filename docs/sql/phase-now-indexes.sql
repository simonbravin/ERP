-- =============================================================================
-- Bloqer — Phase NOW: missing compound indexes (2026-02-22)
-- =============================================================================
-- These 3 indexes are REQUIRED in production. They are not yet present in
-- packages/database/prisma/schema.prisma as named compound indexes.
--
-- HOW TO APPLY:
--   Option A (preferred): add the @@index([...]) entries to schema.prisma and
--   run `pnpm --filter @repo/database db:migrate` which generates the SQL for you.
--   Schema lines are shown as comments next to each statement below.
--
--   Option B (emergency / already-running prod):
--   Run these statements directly on the Neon database via Neon Console or psql.
--   They use CREATE INDEX CONCURRENTLY so they will NOT lock the table.
--   Must be run OUTSIDE a transaction block (CONCURRENTLY cannot run inside one).
--
-- POSTGRES VERSION: Neon runs Postgres 16. IF NOT EXISTS is supported.
-- CONCURRENTLY: safe for production; builds index without taking an exclusive lock.
-- =============================================================================

-- 1. OrgMember — auth context lookup
--    Query pattern: WHERE user_id = $1 AND active = true
--    Used by: getAuthContext() → getOrgContext() on every authenticated request
--    Prisma schema line to add inside model OrgMember:
--      @@index([userId, active])
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_member_user_active
  ON public.org_member (user_id, active);

-- 2. FinanceTransaction — finance list queries
--    Query pattern: WHERE org_id = $1 AND type = $2 AND issue_date BETWEEN ... AND deleted = false
--    Used by: listFinanceTransactions, getCompanyTransactions, finance AP/AR pages
--    Prisma schema line to add inside model FinanceTransaction:
--      @@index([orgId, type, issueDate, deleted])
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_finance_tx_org_type_date
  ON finance.finance_transaction (org_id, type, issue_date, deleted);

-- 3. AuditLog — audit trail pagination
--    Query pattern: WHERE org_id = $1 ORDER BY created_at DESC (with LIMIT/OFFSET)
--    Used by: audit log viewer, super-admin org history pages
--    Prisma schema line to add inside model AuditLog:
--      @@index([orgId, createdAt(sort: Desc)])
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_org_created
  ON public.audit_logs (org_id, created_at DESC);

-- =============================================================================
-- VERIFICATION — run after applying to confirm indexes are active:
-- =============================================================================
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE indexname IN (
--   'idx_org_member_user_active',
--   'idx_finance_tx_org_type_date',
--   'idx_audit_log_org_created'
-- );
--
-- Expected: 3 rows returned with status = 'valid'
-- If CONCURRENTLY build is still in progress: pg_index.indisvalid = false
-- Check build progress: SELECT * FROM pg_stat_progress_create_index;
-- =============================================================================
