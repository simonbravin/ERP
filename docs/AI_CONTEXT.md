# Bloqer — AI Context Document
> Unified architecture context for Cursor AI, Claude Code, and other AI agents.
> Reverse-engineered from the codebase. Last updated: 2026-02-22 (v1.1 — scale review).
> DO NOT summarize or simplify this document — it is the source of truth for AI agents.
> For full scale rules, also read: `.claude/skills/bloqer-scalability.skill`

---

## 1. WHAT IS BLOQER

Bloqer is a **multi-tenant SaaS ERP for Latin American construction companies**. It replaces Excel-based tracking and disconnected tools with an integrated platform covering: project management, WBS-based cost control, budget versioning, progress certifications, finance (AP/AR, cashflow, overhead), inventory, quality (RFI/submittals/inspections), documents, and field reporting.

- **Primary language:** Spanish (LatAm)
- **Target users:** Construction company owners, PMs, site supervisors, accountants
- **Scale:** Small-to-medium firms (5–200 employees)

---

## 2. TECH STACK

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.2.8 App Router + React 19 + TypeScript 5.7 |
| Monorepo | Turborepo 2.3 + pnpm 9.1 workspaces |
| Database | PostgreSQL (Neon serverless) via Prisma 5.22 |
| Auth | NextAuth v5 beta (JWT strategy only, credentials provider) |
| Styling | Tailwind CSS v4 (CSS-first `@theme` config) |
| State | TanStack React Query 5.90 (client) + Server Components (server) |
| Forms | react-hook-form 7.53 + Zod 3.23 via `@repo/validators` |
| Tables | TanStack React Table 8.21 |
| Charts | Recharts 3.7 |
| Background | Inngest 3.15 (30s cron on OutboxEvent table) |
| Storage | Cloudflare R2 (S3-compatible via @aws-sdk/client-s3) |
| Email | Resend 6.9 (password reset only) |
| i18n | next-intl 4.8 (es default, en secondary) |
| Export | ExcelJS + jsPDF + html2canvas |
| DnD | @dnd-kit (WBS tree, schedule) |

---

## 3. MONOREPO STRUCTURE

```
apps/
  web/                  → Next.js app (only deployable app)

packages/
  database/             → @repo/database: Prisma client singleton + schema + seeds
  ui/                   → @repo/ui: shadcn library (nascent)
  validators/           → @repo/validators: ALL Zod schemas + TypeScript types

tooling/
  typescript/           → shared tsconfig bases
```

---

## 4. APP DIRECTORY STRUCTURE (apps/web/)

```
app/
  globals.css           → Tailwind v4 @theme tokens + erp-* component classes
  layout.tsx            → Root layout (fonts, ThemeProvider, QueryClient)
  actions/              → ALL server mutations ('use server') — ~35 files
  api/                  → Minimal REST (NextAuth, Inngest, 2 GET routes)
  [locale]/
    (auth)/             → Public: login, register, invite, super-admin
    (dashboard)/        → Protected: all 11 ERP modules

components/
  ui/                   → 23 shadcn primitives
  layout/               → Sidebar, breadcrumbs, header pieces
  layouts/              → dashboard-shell.tsx (responsive shell with sidebar)
  [domain]/             → Feature components grouped by domain (finance/, budget/, etc.)

lib/
  auth.ts               → NextAuth config
  auth-helpers.ts       → getAuthContext(), requirePermission(), requireAccess()
  permissions.ts        → ROLE_PERMISSIONS matrix + hasPermission()
  org-context.ts        → getOrgContext(userId) → OrgContext
  audit-log.ts          → createAuditLog()
  events/
    event-publisher.ts  → publishOutboxEvent(tx, params)
  utils.ts              → cn() helper
  utils/serialization.ts → serializeForClient()

hooks/
  use-permissions.ts    → Client-side RBAC hook
  use-message-bus.ts    → Client event bus
  use-chart-export.ts   → Chart screenshot export

inngest/
  client.ts             → Inngest singleton
  functions/
    event-dispatcher.ts → 30s cron polls OutboxEvent table

i18n/                   → next-intl config + routing
messages/               → es.json (primary), en.json
types/
  next-auth.d.ts        → JWT token type extensions
```

---

## 5. DATABASE ARCHITECTURE

### Prisma Multi-Schema
```
public    → Core: Organization, User, OrgMember, Project, WbsNode, Budget*, Certification*, etc.
finance   → Financial: FinanceTransaction, FinanceLine, Payment, BankAccount, OverheadAllocation
inventory → Stock: InventoryItem, InventoryLocation, InventoryMovement, InventoryConsumption
quality   → QA: RFI, Submittal, Inspection, InspectionItem
```

### Universal Conventions
- All IDs: `String @id @default(uuid())` — UUID v4, never autoincrement
- All column names: `@map("snake_case")`, table names: `@@map("snake_case")`
- All money: `Decimal @db.Decimal(15, 2)` — NEVER Float
- All tenant entities: `orgId String` FK to Organization with cascade delete
- Timestamps: `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`

### Key Models Reference
| Model | Schema | Purpose |
|-------|--------|---------|
| Organization | public | Tenant root (name, slug, subscriptionPlan, maxProjects, maxUsers) |
| OrgMember | public | Tenant membership (role, customPermissions JSON) |
| Project | public | Construction project (phase, status, totalBudget) |
| WbsNode | public | Work breakdown hierarchy (self-ref, code, progressPct) |
| BudgetVersion | public | Budget snapshot (DRAFT/BASELINE/APPROVED) |
| BudgetLine | public | Cost item per WBS node |
| Certification | public | Monthly progress billing (integritySeal) |
| ChangeOrder | public | Scope changes (DEVIATION/APPROVED_CHANGE) |
| DailyReport | public | Field activity log (weather, labor, equipment, photos) |
| Party | public | Suppliers/clients/subcontractors |
| GlobalParty | public | Verified supplier directory (cross-tenant) |
| FinanceTransaction | finance | AP/AR/expenses/income (documentType, paidDate, retentionAmount) |
| InventoryMovement | inventory | Stock movements (PURCHASE/TRANSFER/ISSUE/ADJUSTMENT) |
| OutboxEvent | public | Async event queue (PENDING/COMPLETED/FAILED) |
| AuditLog | public | Immutable mutation history (beforeSnapshot, afterSnapshot) |

---

## 6. DATA FLOW

### Mutation Path (canonical)
```
Client Component
  → Server Action (app/actions/[domain].ts)
    → getAuthContext()          // validate session + org membership from JWT
    → requirePermission(...)    // enforce RBAC
    → schema.parse(input)       // validate via @repo/validators
    → prisma.$transaction([
        mutation,
        publishOutboxEvent(tx, ...)  // atomic side-effect registration
      ])
    → revalidatePath(...)        // bust Next.js cache
    → return serialized result
  ← Inngest cron (30s): picks up OutboxEvent → processes → marks COMPLETED
```

### Read Path
```
async Server Component page
  → Server Action (list/get functions)
    → getAuthContext()          // validates org context
    → prisma.findMany({ where: { orgId: org.orgId, ...filters } })
    → serialize (Number(decimal), Date.toISOString())
  → passes props to *-client.tsx Client Component
```

### Auth Flow
```
JWT token fields: { sub, email, name, isSuperAdmin, orgId, orgMemberId, role, orgName }
Server: auth() → getSession() → getAuthContext()
Client: useSession() → usePermissions() → can('finance', 'create')
Edge (middleware): getToken() [NEVER import lib/auth.ts in middleware]
```

---

## 7. PERMISSION SYSTEM

### Roles (hierarchy)
`VIEWER < ACCOUNTANT < EDITOR < ADMIN < OWNER`

### Modules
`dashboard | projects | budget | finance | certifications | inventory | quality | documents | reports | team | settings`

### Permissions
`view | create | edit | delete | export | approve`

### Enforcement layers
1. **Middleware (Edge):** `canViewModule(role, module)` — coarse route blocking
2. **Server Actions:** `requirePermission('MODULE', 'action')` — fine-grained
3. **Client:** `usePermissions()` hook — `can('finance', 'create')`

### Custom permissions
`OrgMember.customPermissions` (JSON) overrides role base per module. Always resolved via `getEffectivePermissions(role, customPermissions)`.

---

## 8. SERVER ACTION TEMPLATE

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@repo/database'
import { requirePermission, getAuthContext } from '@/lib/auth-helpers'
import { publishOutboxEvent } from '@/lib/events/event-publisher'
import { mySchema, type MyInput } from '@repo/validators'

export async function createMyEntity(input: MyInput) {
  const { session, org } = await getAuthContext()
  await requirePermission('MODULE', 'create')
  const parsed = mySchema.parse(input)

  const entity = await prisma.$transaction(async (tx) => {
    const result = await tx.myEntity.create({
      data: { orgId: org.orgId, ...parsed }
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'myEntity.created',
      entityType: 'MyEntity',
      entityId: result.id,
      payload: { ...parsed },
    })
    return result
  })

  revalidatePath('/[locale]/(dashboard)/my-module')
  return { success: true, id: entity.id }
}
```

---

## 9. UI DESIGN SYSTEM

### Brand Colors (CSS token names)
- Navy: `--navy` (sidebar, primary actions) = HSL 222 36% 20%
- Orange: `--orange` (accent, ring, CTA) = HSL 28 68% 50%
- Dark mode: `.dark` class on `<html>`
- Theme variants: `[data-theme='midnight']`, `[data-theme='slate']`

### Critical Rule: NEVER hardcode colors
```tsx
// WRONG
<div className="bg-white text-gray-900 border-gray-200" />
// CORRECT
<div className="bg-card text-foreground border-border" />
```

### ERP Component Classes (defined in globals.css @layer)
```
erp-view-container  → Page container (max-w-7xl)
erp-container       → Full-width container (max-w-screen-2xl)
erp-card            → Standard card (rounded-xl + border + shadow)
erp-card-header     → Card header (border-b px-6 py-4)
erp-card-body       → Card body (px-6 py-4)
erp-section-header  → Title + desc block
erp-section-title   → Text-lg font-semibold
erp-section-desc    → Text-sm text-muted-foreground
erp-page-title      → Text-2xl font-semibold
erp-header-row      → Responsive header (col mobile, row desktop)
erp-header-actions  → Action buttons (flex-wrap gap-2)
erp-stack           → Vertical spacing (space-y-4 md:space-y-6)
erp-grid-cards      → KPI grid (1→2→4 cols)
erp-table-wrap      → Table scroll container
erp-table-cell      → Standard cell
erp-table-cell-numeric  → Right-aligned monospace
erp-table-cell-currency → Currency cell (whitespace-nowrap)
erp-form-modal      → Dialog form (max-w-4xl)
erp-form-page       → Page form (max-w-3xl)
```

### Status Badges
```tsx
<span className="badge-success">Aprobado</span>
<span className="badge-warning">Pendiente</span>
<span className="badge-danger">Vencido</span>
<span className="badge-neutral">Borrador</span>
<span className="badge-info">En proceso</span>
<span className="badge-phase-construction">Construcción</span>
```

### Financial Number Display
```tsx
// Always use monospace + tabular-nums for financial data
<span className="numeric">{amount}</span>
<span className="currency">{formatCurrency(amount)}</span>
```

---

## 10. COMPONENT PATTERNS

### Page pattern (Server → Client)
```
app/[locale]/(dashboard)/finance/page.tsx      → Server Component, fetches data
components/finance/finance-page-client.tsx     → 'use client', handles interactivity
```

### File naming
- `*-list-client.tsx` — list view with filtering/sorting
- `*-form.tsx` — create/edit form (react-hook-form)
- `*-dialog.tsx` — modal wrapper
- `*-detail-client.tsx` — detail view
- `*-page-client.tsx` — page-level wrapper

### Import paths
```typescript
import { Button } from '@/components/ui/button'   // shadcn primitive
import { cn } from '@/lib/utils'                   // class merger
import { prisma } from '@repo/database'             // Prisma client (server only)
import { mySchema } from '@repo/validators'         // Zod schemas
import { toast } from 'sonner'                      // toasts
```

---

## 11. DOMAIN ENTITY QUICK REFERENCE

### Construction workflow spine
```
Organization → Project → WbsNode → BudgetLine → BudgetResource
                                 → ScheduleTask
                                 → CertificationLine ← Certification
                                 → DailyReport (progress) → WbsProgressUpdate
```

### Finance spine
```
FinanceTransaction → FinanceLine (→ WbsNode)
                   → Payment (→ BankAccount)
FinanceTransaction → OverheadAllocation (→ Project)
Party → FinanceTransaction
```

### Inventory spine
```
InventoryItem → InventoryMovement (fromLocation → toLocation)
DailyReport → InventoryConsumption → InventoryItem
```

### Status flows
```
BudgetVersion:  DRAFT → BASELINE → APPROVED
ChangeOrder:    DRAFT → PENDING → APPROVED | REJECTED
Certification:  DRAFT → SUBMITTED → APPROVED → PUBLISHED
DailyReport:    DRAFT → SUBMITTED → APPROVED → PUBLISHED
FinanceTransaction: DRAFT → PENDING → APPROVED | PAID | OVERDUE | CANCELLED
```

---

## 12. CRITICAL RULES (NEVER VIOLATE)

1. **orgId scope**: Every Prisma query includes `where: { orgId: org.orgId }` — no exceptions
2. **No Prisma in components**: All DB access goes through Server Actions in `app/actions/`
3. **No Float for money**: Use `Prisma.Decimal` + `@db.Decimal(15,2)` always
4. **No REST for mutations**: Use Server Actions, not POST API routes
5. **Atomic outbox**: `publishOutboxEvent` runs inside `prisma.$transaction()` — never outside
6. **No lib/auth in middleware**: Edge runtime breaks on bcrypt/Prisma imports — use `getToken()`
7. **Validators in package**: Zod schemas defined in `@repo/validators`, never inline in actions
8. **Token-based colors**: All UI colors via CSS custom properties — no hardcoded values
9. **Serialize before client**: `Number(decimal)` and `.toISOString()` before passing to Client Components
10. **Spanish error messages**: `throw new Error('No tienes permiso...')` in Server Actions

---

## 13. ENVIRONMENT VARIABLES

```bash
DATABASE_URL          # PostgreSQL pooled (Neon)
DIRECT_URL            # PostgreSQL direct (Neon, migrations only)
NEXTAUTH_SECRET       # JWT signing secret
NEXTAUTH_URL          # App base URL
NEXT_PUBLIC_APP_URL   # Public app URL
RESEND_API_KEY        # Transactional email
RESEND_FROM_EMAIL     # Sender address
R2_ACCOUNT_ID         # Cloudflare R2
R2_ACCESS_KEY_ID      # Cloudflare R2
R2_SECRET_ACCESS_KEY  # Cloudflare R2
R2_BUCKET_NAME        # Cloudflare R2
INNGEST_*             # Auto-configured by Inngest SDK
```

---

## 14. DEVELOPMENT COMMANDS

```bash
# From root
pnpm dev              # Start all apps (Turborepo)
pnpm build            # Build all apps
pnpm typecheck        # TypeScript check all packages
pnpm lint             # Lint all packages

# From packages/database/
pnpm db:generate      # Regenerate Prisma client
pnpm db:push          # Push schema (dev, no migration file)
pnpm db:migrate       # Create + apply migration (prod)
pnpm db:studio        # Open Prisma Studio
pnpm seed             # Run seed.ts
pnpm seed:demo        # Run seed-demo.ts

# From apps/web/
pnpm dev              # Next.js dev server
pnpm build            # Next.js build
```

---

## 15. I18N RULES

- Default locale: `es` (Spanish) — always prefix URLs: `/es/...`
- Secondary: `en` — `/en/...`
- Message files: `apps/web/messages/es.json` (primary), `messages/en.json`
- Server Component: `const t = await getTranslations('namespace')`
- Client Component: `const t = useTranslations('namespace')`
- Locale detection: DISABLED — always routes to `es` by default
- All user-facing strings must have both `es` and `en` entries

---

## 16. FILE LOCATIONS QUICK REFERENCE

| What | Where |
|------|-------|
| Prisma schema | `packages/database/prisma/schema.prisma` |
| Zod validators | `packages/validators/src/[domain].ts` |
| Server actions | `apps/web/app/actions/[domain].ts` |
| API routes | `apps/web/app/api/` |
| UI components | `apps/web/components/[domain]/` |
| Shadcn primitives | `apps/web/components/ui/` |
| Auth config | `apps/web/lib/auth.ts` |
| Auth helpers | `apps/web/lib/auth-helpers.ts` |
| Permissions | `apps/web/lib/permissions.ts` |
| Design tokens | `apps/web/app/globals.css` |
| i18n messages | `apps/web/messages/es.json` |
| Middleware | `apps/web/middleware.ts` |
| Inngest handlers | `apps/web/inngest/functions/` |
| Event publisher | `apps/web/lib/events/event-publisher.ts` |
| Audit log | `apps/web/lib/audit-log.ts` |
| R2 client | `apps/web/lib/r2-client.ts` |

---

## 17. SCALE RULES — CRITICAL CONSTRAINTS (added v1.1)

### Hard rules — violating these creates production incidents at scale

| # | Rule | Why |
|---|------|-----|
| SC1 | `findMany()` requires `take/skip` on high-volume tables | Unbounded queries OOM at scale |
| SC2 | Never use `session.user.role` for authorization in mutations | JWT can be stale after role change |
| SC3 | Never hard-delete an Organization — use `isBlocked=true` | Cascade destroys all data in all 4 schemas |
| SC4 | Export >50 rows → use `ExportRun` + Inngest async path | Vercel 60s timeout kills sync exports |
| SC5 | Never generate sequence numbers outside a DB transaction | COUNT+1 races under concurrent load |
| SC6 | Module activation check → use `ModuleActivation` table, not `enabledModules` array | Two systems exist; table is authoritative |
| SC7 | All migrations must be additive for zero-downtime | Renaming a live column breaks running code |

### Known technical debts
| Debt | Impact | Fix when |
|------|--------|----------|
| Sequence number race condition | Duplicate invoice numbers under high concurrency | >50 concurrent users/org |
| No OutboxEvent cleanup | Table grows to hundreds of millions of rows | Before 1,000 active orgs |
| No AuditLog retention | Unbounded JSON snapshot growth | Before 500 active orgs |
| JWT role staleness (15min window) | Revoked users retain access until JWT expires | Before enterprise contracts |
| Dashboard KPIs computed on demand | Heavy aggregation on every page load | When P95 >2s |
| Single Inngest function for all events | Serialized queue for all event types | When >5 distinct event handlers needed |
| No rate limiting | API abuse, runaway imports | Before 500 active orgs |
| No observability (no Sentry) | Silent production failures | ASAP — before any scale |

### Required database indexes (must exist in production)
```sql
CREATE INDEX idx_org_member_user_active ON public.org_member(user_id, active);
CREATE INDEX idx_finance_tx_org_type_date ON finance.finance_transaction(org_id, type, issue_date, deleted);
CREATE INDEX idx_outbox_status_created ON public.outbox_event(status, created_at);
CREATE INDEX idx_wbs_node_project_parent ON public.wbs_node(project_id, parent_id);
CREATE INDEX idx_audit_log_org_created ON public.audit_log(org_id, created_at DESC);
CREATE INDEX idx_daily_report_project_date ON public.daily_report(project_id, report_date DESC);
```

For full scale guidance see: `.claude/skills/bloqer-scalability.skill`
