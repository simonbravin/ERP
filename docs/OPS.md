# Bloqer — Operator Quickstart
> For engineers on-call or onboarding a new customer.

---

## 1. Health check

```bash
# Local dev (port 3333)
curl http://localhost:3333/api/health

# Production
curl https://<your-vercel-url>/api/health
```

**Expected (healthy):** `200 { "status": "ok", "db": "ok", "timestamp": "..." }`
**Expected (DB down):** `500 { "status": "error", "db": "error", "message": "..." }`

Configure your uptime monitor to ping `/api/health` every 60 seconds.
Vercel post-deploy: add `/api/health` as the deployment health check URL.

---

## 2. Error monitoring (Sentry)

- **Where errors appear:** Sentry dashboard → Issues tab → filter by project `bloqer-web`
- **Required env vars** (set in Vercel → Project → Environment Variables):
  | Variable | Value |
  |----------|-------|
  | `SENTRY_DSN` | From Sentry project settings → Client Keys |
  | `NEXT_PUBLIC_SENTRY_DSN` | Same DSN value (must be public for browser) |
  | `SENTRY_ORG` | Sentry org slug |
  | `SENTRY_PROJECT` | Sentry project slug |
- After setting vars, run `pnpm install` in `apps/web/` and redeploy
- All server errors are auto-captured via `onRequestError` hook in `instrumentation.ts`

---

## 3. Outbox cleanup job

- **Where to see it:** Inngest dashboard → Functions → `outbox-event-cleanup`
- **Schedule:** daily at 03:00 UTC
- **What it does:** deletes `COMPLETED` OutboxEvent rows older than 7 days (batches of 5,000)
- **To trigger manually:** Inngest dashboard → Functions → `outbox-event-cleanup` → Invoke
- **Alert to configure:** Inngest dashboard → Alerts → "FAILED events > 10 in 1 hour" → Slack/email

---

## 4. Required database indexes

Three compound indexes must be applied **once** to the Neon production database.
SQL is in `docs/sql/phase-now-indexes.sql`.

```bash
# Option A — Neon Console
# 1. Open https://console.neon.tech → your project → SQL editor
# 2. Paste the contents of docs/sql/phase-now-indexes.sql
# 3. Run (each statement outside a transaction — CONCURRENTLY requirement)

# Option B — psql
psql "$DATABASE_URL" -f docs/sql/phase-now-indexes.sql
```

**Verify applied:**
```sql
SELECT indexname FROM pg_indexes
WHERE indexname IN (
  'idx_org_member_user_active',
  'idx_finance_tx_org_type_date',
  'idx_audit_log_org_created'
);
-- Expected: 3 rows
```

---

## 5. Pre-onboarding checklist (quick version)

Before activating a new paying org, confirm:

- [ ] `GET /api/health` → `200 ok` in production
- [ ] Sentry DSN set and a test error has appeared in the dashboard
- [ ] Outbox cleanup job visible in Inngest dashboard (green last run)
- [ ] Three compound indexes applied in Neon (verified by SELECT above)
- [ ] New org created via super-admin panel (not via DB)
- [ ] Org `subscriptionStatus` set to `ACTIVE` and plan limits configured

Full checklist: `docs/TECHNICAL_ROADMAP.md` → "Release checklist" section.
