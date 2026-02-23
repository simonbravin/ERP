# Bloqer — Technical Roadmap: Operational Readiness & Scale Safety
> **Audience:** Engineering team
> **Authored by:** CTO review, 2026-02-22
> **Source of truth:** repository + `docs/AI_CONTEXT.md` §17
> **Scope:** Operational readiness and scale safety — NOT feature development
> **Constraint:** Prefer minimal safe changes. Maintain Server Actions, Prisma multi-schema, Outbox, RBAC patterns.

---

## Executive summary

Bloqer is structurally sound. The architecture — multi-tenant Server Actions + atomic Outbox + RBAC — is the right foundation at this stage. What's missing is the **operational layer**: the instrumentation, guardrails, and database hygiene that prevent silent failures from becoming customer-visible incidents.

This roadmap is organized around the `"Fix when"` thresholds established in AI_CONTEXT §17. Every item below has a hard deadline linked to org count or a specific risk event (enterprise contract, concurrency spike). Nothing here is premature. Some items are overdue.

---

## Current state snapshot (verified 2026-02-22)

| Concern | Status | Notes |
|---------|--------|-------|
| `/api/health` endpoint | ❌ Missing | No uptime monitoring possible |
| Error tracking (Sentry) | ❌ Missing | Silent failures in production |
| Rate limiting | ❌ Missing | No Upstash, no edge middleware rate limit |
| OutboxEvent cleanup job | ❌ Missing | Events accumulate forever |
| AuditLog archiving | ❌ Missing | Unbounded JSON snapshot growth |
| `idx_org_member_user_active` compound index | ❌ Missing | Auth context query unoptimized |
| `idx_finance_tx_org_type_date` compound index | ❌ Missing | Finance list query unoptimized |
| `idx_audit_log_org_created` compound index | ❌ Missing | Audit queries unoptimized |
| `listFinanceTransactions` pagination | ❌ Missing | Unbounded `findMany` on high-volume table |
| `listNotifications` pagination | ❌ Missing | Unbounded `findMany` |
| `getAuthContextCached` | ❌ Missing | Duplicate DB round-trips per page load |
| `OrgSequenceCounter` (sequence race fix) | ❌ Missing | COUNT+1 race condition exists |
| JWT staleness fix (`sessionVersion`) | ❌ Missing | 15-min window after role revoke |
| `Organization.isBlocked` field | ✅ Exists | Org deactivation model is correct |
| `ExportRun` model | ✅ Exists | Async export infrastructure ready |
| OutboxEvent `(status, createdAt)` index | ✅ Exists | Dispatcher query is indexed |
| WbsNode `(projectId, parentId)` index | ✅ Exists | Tree traversal is indexed |
| DailyReport `(projectId, reportDate)` index | ✅ Exists | |
| Dashboard KPI caching | 🟡 Deferred | Not urgent until P95 >2s |

---

## Phase 1 — NOW
### Required before onboarding any new paying company
**Timeline: 1–4 weeks**

These items have zero acceptable excuses for delay. They take less than a day each to implement, carry no architecture risk, and prevent production fires.

---

### 1.1 — Health check endpoint
**Priority: P0 — do first**

**Why it matters:**
Without a health endpoint, Vercel deployments can go fully down and no alert fires. Uptime monitoring tools, Vercel deployment health checks, and Inngest's own alerting all require a reachable endpoint. A silent database outage currently shows users a blank screen with no notification.

**Files involved:**
- `apps/web/app/api/health/route.ts` ← create new
- `apps/web/middleware.ts` ← verify `/api/health` is already excluded (matcher pattern `(?!api|...)` covers it)

**Implementation:**
```typescript
// apps/web/app/api/health/route.ts
import { prisma } from '@repo/database'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return Response.json({ status: 'ok', db: 'connected', ts: new Date().toISOString() })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    return Response.json({ status: 'error', db: 'disconnected', error: msg }, { status: 503 })
  }
}
```

No authentication. No orgId. No RBAC. This endpoint is intentionally public.

**Acceptance criteria:**
- `GET /api/health` returns `200 { status: 'ok' }` in production
- `GET /api/health` returns `503` if DB is unreachable
- Configure external uptime monitor (UptimeRobot / Vercel Analytics) to ping every 60s
- Vercel deployment succeeds only if health check passes post-deploy

---

### 1.2 — Error tracking (Sentry)
**Priority: P0**

**Why it matters:**
`audit-log.ts` silently swallows errors. `event-dispatcher.ts` logs to `console.log`. Server Actions throw errors that are never aggregated. Today, production failures are invisible unless a user reports them. This is unacceptable even at 1 org.

**Files involved:**
- `apps/web/instrumentation.ts` ← create new (Next.js 15 instrumentation hook)
- `apps/web/sentry.client.config.ts` ← create
- `apps/web/sentry.server.config.ts` ← create
- `apps/web/lib/audit-log.ts` ← add `Sentry.captureException` in catch block
- `apps/web/inngest/functions/event-dispatcher.ts` ← add `Sentry.captureException` for failed events
- `apps/web/next.config.ts` ← add `withSentryConfig` wrapper

**Implementation approach:**
```typescript
// apps/web/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}
```

Tag every event with `orgId` and `userId`:
```typescript
// In Server Actions catch blocks / audit-log.ts
import * as Sentry from '@sentry/nextjs'
Sentry.setUser({ id: session.user.id, orgId: org.orgId })
Sentry.captureException(err)
```

Add to `.env`:
```
SENTRY_DSN=...
SENTRY_ORG=...
SENTRY_PROJECT=...
```

**Acceptance criteria:**
- All unhandled Server Action errors are captured in Sentry with `orgId` + `userId` tags
- `audit-log.ts` catch block sends to Sentry (not just `console.error`)
- `event-dispatcher.ts` FAILED events trigger Sentry capture
- Sentry alerts configured: >5 errors/minute → Slack/email notification
- Zero PII (passwords, tokens) in Sentry payloads (verify `ignoreErrors` config)

---

### 1.3 — Add 3 missing compound database indexes
**Priority: P0**

**Why it matters:**
Three of the six required compound indexes from AI_CONTEXT §17 are missing. The existing single-column indexes are insufficient for the specific filter+sort patterns used in Server Actions. These queries run on every page load for every user.

**Current state (verified against schema):**
| Required index | Exists? | What exists instead |
|---------------|---------|---------------------|
| `OrgMember(userId, active)` | ❌ | `(userId)` only |
| `FinanceTransaction(orgId, type, issueDate, deleted)` | ❌ | `(orgId, type, status)` + `(issueDate)` separately |
| `AuditLog(orgId, createdAt DESC)` | ❌ | `(orgId, entityType, entityId)` + `(createdAt)` separately |
| `OutboxEvent(status, createdAt)` | ✅ | Already correct |
| `WbsNode(projectId, parentId)` | ✅ | Already correct |
| `DailyReport(projectId, reportDate)` | ✅ | Already correct |

**Files involved:**
- `packages/database/prisma/schema.prisma` ← add 3 `@@index` entries
- New migration: `pnpm db:migrate` from `packages/database/`

**Implementation (additive — no breaking change):**

In `model OrgMember`:
```prisma
@@index([userId, active])  // ADD — auth context lookup
```

In `model FinanceTransaction`:
```prisma
@@index([orgId, type, issueDate, deleted])  // ADD — listFinanceTransactions filter
```

In `model AuditLog`:
```prisma
@@index([orgId, createdAt(sort: Desc)])  // ADD — audit trail pagination
```

**Acceptance criteria:**
- Migration applies cleanly to production (Neon) with no downtime
- `EXPLAIN ANALYZE` on `listFinanceTransactions` WHERE clause uses the new index (seq scan → index scan)
- All 6 required indexes from AI_CONTEXT §17 are confirmed present in production

---

### 1.4 — Pagination on `listFinanceTransactions` and `listNotifications`
**Priority: P0**

**Why it matters:**
`listFinanceTransactions` uses `findMany` with no `take/skip`. An org with 2 years of invoices could have thousands of rows returned in a single request. Similarly, `notifications.findMany` has no limit. These are the two highest-frequency unbounded queries.

**Files involved:**
- `apps/web/app/actions/finance-transactions.ts` — `listFinanceTransactions()`
- `apps/web/app/actions/notifications.ts` — notification list function
- All client components that call these → will need to handle paginated response

**Implementation approach:**

Add a standard paginated response type to `@repo/validators`:
```typescript
// packages/validators/src/common.ts
export type PaginatedResponse<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
})
```

Update `listFinanceTransactions`:
```typescript
export async function listFinanceTransactions(
  filters: ListFinanceTransactionsFilters & { page?: number; pageSize?: number } = {}
) {
  const { org } = await getAuthContext()
  const page = filters.page ?? 1
  const pageSize = Math.min(filters.pageSize ?? 50, 200)
  const skip = (page - 1) * pageSize

  const [items, total] = await prisma.$transaction([
    prisma.financeTransaction.findMany({ where, orderBy, take: pageSize, skip, include }),
    prisma.financeTransaction.count({ where }),
  ])

  return {
    items: items.map(serializeTransaction),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}
```

**Acceptance criteria:**
- `listFinanceTransactions` never returns more than 200 rows in a single call
- Response shape matches `PaginatedResponse<T>`
- Client components show page navigation (or infinite scroll with cursor)
- `listNotifications` limited to 50 most recent by default, with `unreadOnly` filter still working
- Existing tests (if any) updated; no visual regression in finance list page

---

### 1.5 — OutboxEvent cleanup job
**Priority: P1 — before 100 orgs**

**Why it matters:**
`OutboxEvent` rows are never deleted. Every mutation writes a row. At 100 orgs × 50 users × 20 mutations/day = 100,000 rows/day = 36 million rows/year. The `event-dispatcher.ts` PENDING query gets slower as the table grows, even with the `(status, createdAt)` index.

**Files involved:**
- `apps/web/inngest/functions/outbox-cleanup.ts` ← create new
- `apps/web/app/api/inngest/route.ts` ← register new function

**Implementation:**
```typescript
// apps/web/inngest/functions/outbox-cleanup.ts
export const outboxEventCleanup = inngest.createFunction(
  { id: 'outbox-event-cleanup', name: 'Limpiar eventos OutboxEvent expirados' },
  { cron: '0 3 * * *' }, // Diariamente a las 3am UTC
  async ({ step }) => {
    const completedCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 días
    const failedCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)   // 7 días

    const deleted = await step.run('delete-expired-events', async () => {
      const result = await prisma.outboxEvent.deleteMany({
        where: {
          OR: [
            { status: 'COMPLETED', createdAt: { lt: completedCutoff } },
            { status: 'FAILED', createdAt: { lt: failedCutoff } },
          ],
        },
      })
      return result.count
    })

    return { deletedCount: deleted }
  }
)
```

Register in `app/api/inngest/route.ts`:
```typescript
import { outboxEventCleanup } from '@/inngest/functions/outbox-cleanup'
// Add to the serve() call
```

**Acceptance criteria:**
- Cleanup job runs daily at 3am UTC in production
- COMPLETED rows >30 days are deleted in each run
- FAILED rows >7 days are deleted
- Job is visible in Inngest dashboard with last run timestamp
- OutboxEvent table row count is verified to stabilize after first run

---

## Phase 2 — NEXT
### Required before 50 active organizations
**Timeline: 4–12 weeks**

These items address risks that are tolerable with 5-10 orgs but become P0 incidents at 50. Implement in order of risk severity.

---

### 2.1 — Rate limiting via Upstash Redis
**Priority: P0 at 50 orgs**

**Why it matters:**
No rate limiting means a single runaway import script, a browser automation, or a basic scraper can exhaust Neon connection pool and bring down all tenants. The worst-case scenario: a single org's bulk import causes a `Too many connections` error for every other tenant.

**Files involved:**
- `apps/web/middleware.ts` ← add rate limit check
- `apps/web/lib/rate-limit.ts` ← create helper
- `apps/web/app/actions/import-budget.ts` ← add action-level rate limit
- `apps/web/app/actions/inventory.ts` ← add action-level rate limit (bulk movements)
- `.env` ← add `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

**Implementation approach:**

Edge middleware layer (request-level):
```typescript
// apps/web/lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export const orgRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(120, '1 m'), // 120 req/min per org
  prefix: 'rl:org',
})

export const userMutationRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(30, '1 m'), // 30 mutations/min per user
  prefix: 'rl:user',
})

export const bulkImportRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '1 m'), // 5 bulk imports/min per org
  prefix: 'rl:import',
})
```

In `middleware.ts`, after auth check:
```typescript
const orgId = token.orgId as string | undefined
if (orgId) {
  const { success } = await orgRatelimit.limit(orgId)
  if (!success) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intenta en un momento.' },
      { status: 429 }
    )
  }
}
```

In bulk actions (`import-budget.ts`, `inventory.ts` movements):
```typescript
const { success } = await bulkImportRatelimit.limit(org.orgId)
if (!success) throw new Error('Límite de importaciones alcanzado. Espera un minuto.')
```

**Acceptance criteria:**
- A single org cannot exceed 120 requests/minute without receiving HTTP 429
- Bulk import endpoint returns 429 after 5 calls/minute with Spanish error message
- Rate limit keys are scoped to `orgId` — one org's limit never blocks another
- Upstash Redis is configured in Vercel environment variables
- Rate limit errors are captured in Sentry (not treated as user errors)

---

### 2.2 — JWT staleness fix: reduce TTL + `sessionVersion`
**Priority: P1 at enterprise contracts**

**Why it matters:**
When a company fires an employee, their account remains active for up to 15 minutes after an admin sets `active = false` or changes their role. This is tolerable for small orgs but is a hard blocker for enterprise contracts where access revocation must be near-instant.

**Two-step approach (ship step A now, step B when needed):**

**Step A (now) — Reduce JWT TTL:**
```typescript
// apps/web/lib/auth.ts — in NextAuth config
session: {
  strategy: 'jwt',
  maxAge: 8 * 60 * 60, // 8 hours total session
},
jwt: {
  maxAge: 15 * 60, // 15-minute JWT, requires re-issue on each request
},
```
This is already the intended config. Verify it is enforced and the token is re-issued silently on each request via the NextAuth `jwt` callback.

**Step B (before enterprise) — `sessionVersion` on OrgMember:**

Schema addition (additive — no breaking change):
```prisma
// In model OrgMember
sessionVersion Int @default(1) @map("session_version")
```

In the JWT `session` callback in `auth.ts`:
```typescript
// When signing JWT: embed orgMember.sessionVersion
token.sessionVersion = orgMember.sessionVersion
```

In `requirePermission()` in `auth-helpers.ts`:
```typescript
// Re-query OrgMember.sessionVersion, compare with JWT value
const member = await prisma.orgMember.findFirst({
  where: { id: org.orgMemberId, active: true },
  select: { sessionVersion: true },
})
if (!member || member.sessionVersion !== session.sessionVersion) {
  throw new Error('Sesión inválida. Por favor inicia sesión nuevamente.')
}
```

In the role-change action (`team.ts`):
```typescript
await prisma.orgMember.update({
  where: { id: memberId },
  data: { role, sessionVersion: { increment: 1 } }, // invalidates existing JWT
})
```

**Files involved:**
- `apps/web/lib/auth.ts` ← JWT TTL config
- `packages/database/prisma/schema.prisma` ← `sessionVersion` on OrgMember
- `apps/web/lib/auth-helpers.ts` ← `requirePermission` re-validation
- `apps/web/app/actions/team.ts` ← increment `sessionVersion` on role change / deactivation

**Acceptance criteria:**
- JWT TTL is ≤15 minutes (verify with browser DevTools → Application → Cookies)
- After an admin changes a member's role, the member's next mutation is rejected with a Spanish re-login prompt
- After `active = false`, the member cannot complete any Server Action
- No extra DB round-trip on read-only operations (only `requirePermission` adds the check, not read paths)

---

### 2.3 — Sequence number race condition fix
**Priority: P1 at >50 concurrent users/org**

**Why it matters:**
`getNextTransactionNumber()` uses `COUNT(*) + 1`. Two simultaneous invoice creations from the same org will receive the same number (`FAC-2026-001` twice). This is a data integrity issue. It's rare today (small teams), but one power user with a fast import script can trigger it.

**Files involved:**
- `packages/database/prisma/schema.prisma` ← new `OrgSequenceCounter` model
- New migration
- `apps/web/app/actions/finance-transactions.ts` ← replace `getNextTransactionNumber()`
- Same pattern for `getNextProjectTransactionNumber()`

**Schema addition (new table — additive):**
```prisma
model OrgSequenceCounter {
  id      String @id @default(uuid())
  orgId   String @map("org_id")
  type    String // matches TransactionType enum
  year    Int
  lastSeq Int    @default(0) @map("last_seq")
  updatedAt DateTime @updatedAt @map("updated_at")

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@unique([orgId, type, year])
  @@map("org_sequence_counters")
  @@schema("public")
}
```

**Replacement function (must run inside `prisma.$transaction`):**
```typescript
export async function getNextTransactionNumber(
  tx: PrismaTransaction,
  orgId: string,
  type: TransactionType,
  year: number
): Promise<string> {
  const prefix = getTransactionTypePrefix(type)

  // Upsert + increment atomically with SELECT FOR UPDATE equivalent
  const counter = await tx.$queryRaw<[{ last_seq: number }]>`
    INSERT INTO public.org_sequence_counters (id, org_id, type, year, last_seq, updated_at)
    VALUES (gen_random_uuid(), ${orgId}, ${type}, ${year}, 1, now())
    ON CONFLICT (org_id, type, year)
    DO UPDATE SET last_seq = org_sequence_counters.last_seq + 1, updated_at = now()
    RETURNING last_seq
  `
  const seq = counter[0].last_seq
  return `${prefix}-${year}-${seq.toString().padStart(5, '0')}` // 5-digit (not 3)
}
```

**Note on 5-digit padding:** The current 3-digit padding caps at 999. Migrating from 3→5 digits changes number format. Do it now, before any org accumulates 999 transactions. New format: `FAC-2026-00001`.

**Acceptance criteria:**
- Two concurrent `createFinanceTransaction` calls from the same org never produce duplicate numbers
- Sequence counter resets per year (year is part of the unique key)
- Old `FAC-2026-001` format still renders correctly on existing records (no data migration needed — just new records use new format)
- `getNextTransactionNumber` signature requires a transaction client (`tx`) — compiler enforces this

---

### 2.4 — AuditLog archiving job
**Priority: P1 at 500 orgs**

**Why it matters:**
AuditLog stores `beforeSnapshot` and `afterSnapshot` as full JSON. A single `updateBudgetLine` call writes ~2KB. At 100 mutations/day across 500 orgs = 100MB/day = 35GB/year. Neon costs and query latency both grow linearly.

**Files involved:**
- `apps/web/inngest/functions/auditlog-archive.ts` ← create new
- `apps/web/app/api/inngest/route.ts` ← register
- R2 bucket path convention: `audit-archive/{orgId}/{year}/{month}.jsonl`

**Implementation:**
```typescript
export const auditLogArchive = inngest.createFunction(
  { id: 'audit-log-archive', name: 'Archivar AuditLog en R2' },
  { cron: '0 2 1 * *' }, // Primer día de cada mes a las 2am UTC
  async ({ step }) => {
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - 2) // 2 años atrás

    // Fetch orgs with old audit logs (paginated — never load all in memory)
    const orgsWithOldLogs = await step.run('find-orgs-with-old-logs', async () => {
      return prisma.$queryRaw<{ org_id: string }[]>`
        SELECT DISTINCT org_id FROM public.audit_logs WHERE created_at < ${cutoff} LIMIT 100
      `
    })

    for (const { org_id } of orgsWithOldLogs) {
      await step.run(`archive-org-${org_id}`, async () => {
        // Fetch in batches of 1,000, stream to R2 as JSONL, then delete
        // See: apps/web/lib/r2-client.ts for R2 upload pattern
      })
    }
  }
)
```

**Acceptance criteria:**
- AuditLog rows older than 2 years are exported to R2 as `{orgId}/{year}/{month}.jsonl` before deletion
- Deletion only happens after successful R2 upload (verify upload response before `deleteMany`)
- Super-admin can retrieve archived logs for a given org/month from R2
- Monthly job runs on the 1st of each month with Inngest dashboard visibility
- `AuditLog` table row count is monitored and verified to stop growing unboundedly

---

### 2.5 — `getAuthContextCached` for page components
**Priority: P2 — developer velocity / server cost**

**Why it matters:**
A dashboard page that renders 5 server components, each calling `getAuthContext()`, makes 5 identical `orgMember` DB lookups in the same request. At 50 orgs × 50 active users × 10 navigations/hour = 250,000 redundant queries/hour. This shows up as Neon compute cost before it shows up as latency.

**Files involved:**
- `apps/web/lib/auth-helpers.ts` ← add `getAuthContextCached`

**Implementation (2-line change):**
```typescript
// apps/web/lib/auth-helpers.ts
import { cache } from 'react'

// Existing function remains — used in mutation actions
export async function getAuthContext() { ... }

// New: memoized within a single RSC render tree
export const getAuthContextCached = cache(getAuthContext)
// Use ONLY in page.tsx / layout.tsx Server Components.
// NEVER use in action files that mutate data.
```

**Usage in page files:**
```typescript
// app/[locale]/(dashboard)/finance/page.tsx
import { getAuthContextCached } from '@/lib/auth-helpers'
const { session, org } = await getAuthContextCached() // single DB hit for the whole page tree
```

**Acceptance criteria:**
- `getAuthContextCached` is exported from `auth-helpers.ts` and documented with a comment
- All `page.tsx` Server Components use the cached version
- All `app/actions/*.ts` files continue to use the uncached `getAuthContext()`
- A code review checklist item is added: "Did you use `getAuthContextCached` in page.tsx?"

---

## Phase 3 — LATER
### Required before 500 active organizations
**Timeline: 3–6 months**

These items address architectural debts that won't cause production incidents today but will require significant emergency work if left until they're urgent.

---

### 3.1 — Dashboard KPI caching (OrgDashboardSnapshot)
**Priority: P1 when P95 dashboard load >2s**

**Why it matters:**
The dashboard currently recomputes aggregate KPIs (total contracted, committed cost, budget variance, projected cashflow) on every navigation. These queries join across `BudgetLine`, `FinanceTransaction`, `Certification`, and `WbsNode`. For a project-heavy org with 5 years of data, this becomes a multi-second page load.

**Files involved:**
- `packages/database/prisma/schema.prisma` ← new `OrgDashboardSnapshot` model
- `apps/web/app/actions/dashboard.ts` ← read from snapshot
- `apps/web/inngest/functions/dashboard-snapshot.ts` ← scheduled refresh
- Trigger: also refresh snapshot after `createCertification`, `approveBudget`, `createFinanceTransaction`

**Approach:**
```prisma
model OrgDashboardSnapshot {
  id           String   @id @default(uuid())
  orgId        String   @unique @map("org_id")
  snapshotJson Json     @map("snapshot_json")
  computedAt   DateTime @map("computed_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@map("org_dashboard_snapshots")
  @@schema("public")
}
```

Read path: `getDashboardKPIs()` reads from `OrgDashboardSnapshot`. If row doesn't exist or is >1 hour old, compute on-demand and save (acceptable for first load). Background Inngest job recomputes nightly and after key mutations.

**Acceptance criteria:**
- P95 dashboard load time ≤500ms for orgs with >1,000 total records
- Snapshot is at most 1 hour stale (nightly refresh + mutation triggers)
- Super-admin can force a snapshot refresh per org
- Fallback: if snapshot missing, compute live (no null state)

---

### 3.2 — Split Inngest event dispatcher into domain handlers
**Priority: P1 when >5 distinct event types need handlers**

**Why it matters:**
`event-dispatcher.ts` is a serialized queue. All event types — certifications, webhooks, emails, inventory alerts — compete for the same 50-event batch every 30 seconds. Adding a slow email handler blocks time-sensitive certification notifications.

**Current state:** The dispatcher logs events and marks them COMPLETED. No actual domain logic runs yet. This means the refactor can happen cleanly before real handlers are added.

**Approach:**

Keep `event-dispatcher.ts` as a router. Add domain-specific Inngest functions triggered by event type:

```typescript
// inngest/functions/handlers/certification-approved.ts
export const certificationApprovedHandler = inngest.createFunction(
  { id: 'certification-approved' },
  { event: 'certification.approved' },
  async ({ event, step }) => {
    // Send email notification, update project KPIs, etc.
  }
)
```

The dispatcher calls `inngest.send({ name: event.eventType, data: event.payload })` instead of processing inline. This decouples routing from processing.

**Migration is additive:** existing `event-dispatcher.ts` continues to work. New handlers are added alongside it. Remove the console.log processing only after domain handlers are in place.

**Acceptance criteria:**
- Each domain handler has its own Inngest function ID (visible in dashboard separately)
- Failed certification events don't block inventory reorder events
- Each handler has its own retry policy (e.g., email: 3 retries; webhook: 5 retries)
- `event-dispatcher.ts` becomes a pure router with no business logic

---

### 3.3 — GlobalParty full-text search
**Priority: P2 when GlobalParty >10,000 rows**

**Why it matters:**
GlobalParty is a cross-tenant shared table of verified suppliers. It currently supports `LIKE '%query%'` search patterns. As verified suppliers accumulate, a free-text search across 100,000 rows with a full table scan will cause visible latency spikes for the supplier search UI.

**Files involved:**
- `packages/database/prisma/schema.prisma` ← add `searchVector` tsvector column
- New migration with `CREATE INDEX ... USING gin(search_vector)`
- `apps/web/app/actions/global-suppliers.ts` ← replace LIKE with `@@search`

**Approach (Postgres native, no external dependency):**
```sql
ALTER TABLE public.global_parties ADD COLUMN search_vector tsvector;
UPDATE public.global_parties SET search_vector = to_tsvector('spanish', coalesce(name,'') || ' ' || coalesce(tax_id,'') || ' ' || coalesce(city,''));
CREATE INDEX idx_global_party_search ON public.global_parties USING gin(search_vector);
```

In Prisma, use the existing `fullTextSearch` preview feature (already enabled in schema).

**Acceptance criteria:**
- GlobalParty search returns results in <100ms for tables up to 100,000 rows
- Search is case-insensitive and accent-insensitive (Spanish normalization: `unaccent` extension)
- Existing `LIKE` queries removed from `global-suppliers.ts`
- `search_vector` column is updated via trigger or nightly Inngest job for new/updated rows

---

### 3.4 — Plan limit enforcement (`maxProjects`, `maxUsers`)
**Priority: P1 before monetization**

**Why it matters:**
`Organization.maxProjects` and `Organization.maxUsers` fields exist but are not enforced in any Server Action. This means a TRIAL org can create unlimited projects. This is a billing integrity issue.

**Files involved:**
- `apps/web/lib/auth-helpers.ts` ← add `requireWithinPlanLimits()`
- `apps/web/app/actions/projects.ts` ← call `requireWithinPlanLimits('project')` in `createProject`
- `apps/web/app/actions/team.ts` ← call `requireWithinPlanLimits('member')` in `createOrgMember`

**Implementation:**
```typescript
// lib/auth-helpers.ts
export async function requireWithinPlanLimits(
  resource: 'project' | 'member',
  orgId: string
) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      maxProjects: true,
      maxUsers: true,
      _count: {
        select: {
          projects: { where: { active: true } },
          members: { where: { active: true } },
        },
      },
    },
  })
  if (!org) throw new Error('Organización no encontrada.')

  if (resource === 'project' && org._count.projects >= org.maxProjects) {
    throw new Error(
      `Alcanzaste el límite de ${org.maxProjects} proyectos en tu plan actual. Actualiza tu plan para continuar.`
    )
  }
  if (resource === 'member' && org._count.members >= org.maxUsers) {
    throw new Error(
      `Alcanzaste el límite de ${org.maxUsers} usuarios en tu plan actual. Actualiza tu plan para continuar.`
    )
  }
}
```

**Acceptance criteria:**
- A TRIAL org cannot create projects beyond `maxProjects`
- A TRIAL org cannot add members beyond `maxUsers`
- Error message is in Spanish and mentions the plan upgrade path
- Super-admin can adjust `maxProjects` and `maxUsers` per org from the super-admin panel

---

## Release checklist
### Must be verified before onboarding a new paying company

This checklist must be completed by an engineer or run as a pre-onboarding script. It is a blocking requirement, not advisory.

```
INFRASTRUCTURE
[ ] GET /api/health returns 200 in production
[ ] Sentry DSN is configured and a test error has been captured
[ ] Inngest dashboard is accessible and event-dispatcher is listed as active
[ ] OutboxEvent cleanup job (outbox-event-cleanup) is registered and scheduled
[ ] Neon connection pool is sized correctly (≥ Vercel serverless concurrency limit)

DATABASE
[ ] All 6 required compound indexes confirmed present in production:
    [ ] OrgMember(userId, active)
    [ ] FinanceTransaction(orgId, type, issueDate, deleted)
    [ ] AuditLog(orgId, createdAt DESC)
    [ ] OutboxEvent(status, createdAt) — verify existing
    [ ] WbsNode(projectId, parentId) — verify existing
    [ ] DailyReport(projectId, reportDate) — verify existing
[ ] No pending migrations on the `packages/database/prisma` schema
[ ] Neon query insights enabled (or pg_stat_statements) for query monitoring

APPLICATION
[ ] listFinanceTransactions returns paginated response (not unbounded)
[ ] listNotifications returns max 50 items by default
[ ] createProject enforces maxProjects limit with Spanish error
[ ] createOrgMember enforces maxUsers limit with Spanish error
[ ] All Server Actions use requirePermission() — no session.user.role checks in mutations

SECURITY
[ ] NEXTAUTH_SECRET is set and rotated from any development value
[ ] JWT TTL is ≤ 15 minutes (verify in auth.ts jwt.maxAge)
[ ] Organization.isBlocked check is verified in getAuthContext() — blocked orgs cannot authenticate
[ ] Rate limiting is configured (or org count < 10 — pre-rate-limit threshold)

MONITORING
[ ] Uptime monitor configured on /api/health (e.g., UptimeRobot, Vercel Analytics)
[ ] Inngest failure alerting configured (FAILED events > 10/hour → notification)
[ ] Sentry alert configured (error spike → Slack/email)

DATA INTEGRITY
[ ] No duplicate transactionNumbers exist in FinanceTransaction (run: SELECT transactionNumber, COUNT(*) FROM finance_transaction GROUP BY transactionNumber HAVING COUNT(*) > 1)
[ ] All Organization records have a valid OrgMember with role OWNER
[ ] No orphaned records: projects without an org, WbsNodes without a project
```

---

## Do NOT do yet
### Premature complexity that would create debt without delivering value

**1. DO NOT build a public REST API (`/api/v1/`)**
The `ApiKey` and `WebhookEndpoint` models exist and anticipate this, but no customer is asking for it. Build it when the first enterprise prospect requires it as a condition. Cost: 3 weeks of work. Benefit today: zero.

**2. DO NOT implement distributed tracing (OpenTelemetry)**
Sentry alone is sufficient until we have >10 engineers deploying independently or microservices. OpenTelemetry on a monolithic Next.js app adds configuration overhead with no operational benefit.

**3. DO NOT migrate to a job queue (BullMQ, SQS)**
Inngest is sufficient for all current and planned background jobs. A queue migration would require infrastructure changes (Redis for BullMQ, AWS for SQS) and breaks the existing Outbox pattern. Revisit only if Inngest is demonstrably not scaling.

**4. DO NOT add caching layers (Redis for queries, CDN for API responses)**
`getAuthContextCached` (React's `cache()`) covers the only high-frequency redundant query. Adding Redis-based query caching before we have performance data would introduce cache invalidation complexity with no measurable benefit.

**5. DO NOT shard the database by tenant**
Neon's serverless PostgreSQL scales well into thousands of orgs. Tenant sharding is an engineering effort of months and is only warranted at >100,000 orgs with P95 latency SLA violations. Not relevant in any foreseeable planning horizon.

**6. DO NOT build a materialized view for dashboard KPIs yet**
The `OrgDashboardSnapshot` table approach (Phase 3.1) should be triggered by actual P95 >2s measurements, not anticipation. Adding it prematurely means maintaining a cache invalidation system before the underlying queries are proven slow.

**7. DO NOT rename module keys in `customPermissions`**
Renaming `'certifications'` → anything else would silently break all customPermissions JSON on OrgMember rows. If a rename is needed, follow the alias migration pattern in `bloqer-scalability.skill` Debt 5. Never do a direct rename.

**8. DO NOT add WebSocket or SSE for real-time updates**
The current polling + `revalidatePath` pattern is correct for the product stage. Real-time requires persistent connections, which are expensive on Vercel serverless. Revisit only if user research identifies real-time as a retention driver.

**9. DO NOT add a second auth strategy (OAuth, SAML) yet**
Credentials-based auth is appropriate for the current LatAm SMB market. SAML/SSO is an enterprise feature that can be added in a dedicated sprint when the first enterprise client requires it. Adding OAuth providers now adds credential management complexity for a segment that won't use it.

---

## Appendix: Implementation effort estimates

| Item | Effort | Risk | Phase |
|------|--------|------|-------|
| Health endpoint | 30 min | Zero | NOW |
| Sentry integration | 3 hours | Low | NOW |
| 3 missing indexes + migration | 1 hour | Zero (additive) | NOW |
| Pagination on finance + notifications | 4 hours | Low (UI change) | NOW |
| OutboxEvent cleanup job | 2 hours | Low | NOW |
| Rate limiting (Upstash) | 4 hours | Medium (middleware change) | NEXT |
| JWT TTL reduction | 30 min | Low | NEXT |
| `sessionVersion` on OrgMember | 4 hours | Medium (schema + auth change) | NEXT |
| OrgSequenceCounter (sequence race) | 6 hours | Medium (schema + query change) | NEXT |
| AuditLog archiving job | 6 hours | Low (additive job) | NEXT |
| `getAuthContextCached` | 1 hour | Zero | NEXT |
| Plan limit enforcement | 3 hours | Low | NEXT |
| Dashboard KPI snapshot | 8 hours | Medium (schema + caching logic) | LATER |
| Split Inngest handlers | 4 hours | Low (additive) | LATER |
| GlobalParty full-text search | 6 hours | Low (additive column) | LATER |

**Total Phase 1 (NOW):** ~10.5 hours
**Total Phase 2 (NEXT):** ~24.5 hours
**Total Phase 3 (LATER):** ~18 hours

---

*This roadmap is a living document. Update it as items are completed and new risks are identified.*
*Do not add items to this roadmap for feature requests — use the product backlog.*
*Last updated: 2026-02-22*
