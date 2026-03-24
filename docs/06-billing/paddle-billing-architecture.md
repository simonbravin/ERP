# Paddle Billing Architecture

This document defines Bloqer's subscription billing architecture using Paddle as payment provider and Bloqer DB as access-control source of truth.

## Principles

- Paddle is the source of truth for commercial events.
- Bloqer DB is the source of truth for app access mode and feature gates.
- Organization is the billing owner entity.
- Webhook processing must be deterministic and idempotent.
- No frontend trust in direct Paddle state.

## Core models

- `BillingPlan`, `BillingPlanPrice`, `PlanEntitlement`
- `BillingCustomer`, `OrganizationSubscription`
- `PromoCode`, `PromoCodePlanRestriction`, `PromoCodeRedemption`
- `BillingEventLog`, `SubscriptionStatusHistory`
- `ManualBillingOverride`, `BillingDocument`

## Super Admin: acceso manual (sin UI dispersa)

En **`/super-admin/organizations/[orgId]/billing`** hay un panel **“Control manual de acceso (billing)”** que llama a las server actions:

- **Acceso gratis / contrato:** crea `ManualBillingOverride` en modo `MANUAL_ACTIVE` o `ENTERPRISE_BYPASS` (acceso completo aunque Paddle no cobre). Podés poner fecha de fin o dejarlo abierto hasta revocar.
- **Solo lectura:** `MANUAL_LOCK` (la org entra pero no puede mutar datos hasta quitar el lock).
- **Extender trial:** requiere fila `OrganizationSubscription`; actualiza `trialEnd` y estado `TRIALING`.
- **Revocar:** por override individual o “quitar todos” de un modo.

Bloqueo total de la organización (sin login) sigue siendo **Block** en la ficha de organización (`isBlocked`), no es lo mismo que `MANUAL_LOCK`.

## Checklist de integración Paddle (qué necesitás)

1. **Cuenta Paddle Billing** (sandbox primero, luego live).
2. **API key** del entorno correcto → `PADDLE_API_KEY`.
3. **Webhook signing secret** del destination que apunte a `https://<tu-dominio>/api/payments/paddle/webhook` → `PADDLE_WEBHOOK_SECRET`.
4. **`PADDLE_ENV`**: `sandbox` o `live` según corresponda.
5. **Precios en Paddle** (trimestral / anual, etc.) y sus **Price IDs** (`pri_...`).
6. En Bloqer: filas **`BillingPlan`** + **`BillingPlanPrice`** con `paddlePriceId` (seed por env `BILLING_SEED_*` o insert manual).
7. Opcional: **client-side token** si usás Paddle.js → `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`.
8. Tras backfill/checkout: **`BILLING_ENFORCEMENT_ENABLED=true`** cuando quieras exigir suscripción/estado para escribir (antes, dejar `false` si hay orgs sin fila nueva).

## Runtime flow

1. Org admin starts checkout from `/settings/subscription`.
2. Server action calls billing orchestrator and Paddle provider.
3. Paddle emits webhook event.
4. Webhook route verifies signature and writes `BillingEventLog`.
5. Webhook handler syncs subscription and writes status history.
6. Access policy reads local state and enforces write permissions.

## Read-only behavior

- Users can log in and view data.
- Write operations are blocked by `assertBillingWriteAllowed`.
- Billing/support/export related actions remain allowed.

## Server action error contract

- Domain mutations call `assertBillingWriteAllowed` in `apps/web/lib/billing/guards.ts`.
- When writes are not allowed, the server throws `BillingWriteForbiddenError` (`apps/web/lib/billing/errors.ts`) with:
  - `code`: `'BILLING_READ_ONLY'`
  - `accessMode`: e.g. `'READ_ONLY'`
  - `reasonCode`: e.g. `'NO_SUBSCRIPTION'`, `'UNPAID'`, etc.
- **Client handling:** use `extractBillingBlockedMessage` or the `toastBillingBlockedIfNeeded` helper in `apps/web/lib/billing/client-toast.ts` so users see a clear toast instead of a generic failure. Pass an optional localized read-only string via `next-intl` under the `billing` message namespace (see `SubscriptionPlansCheckout`).
- Actions that return `{ success: false; error: string }` should map billing errors in a `catch` with `isBillingWriteBlocked` (see `apps/web/app/actions/team.ts`).

## Database migrations (billing DDL)

- Early migrations `20260324120000_add_paddle_billing_foundation` and `20260324123000_add_paddle_billing_foundation_fix` did not apply real DDL (empty file and SQL accidentally commented on one line). Prisma may show them as **already applied** while billing tables are missing.
- Run `pnpm --filter @repo/database exec prisma migrate deploy` after pulling a version that includes `20260326120000_billing_tables_executable`, which contains the executable `CREATE TYPE` / `CREATE TABLE` / indexes / foreign keys for the billing domain.

## Catalog seed (Paddle price IDs)

- Set `BILLING_SEED_PADDLE_PRICE_MONTHLY` / `BILLING_SEED_PADDLE_PRICE_YEARLY` (and optional plan name/code amounts) in `.env`, then run `pnpm --filter @repo/database db:seed-billing-catalog` or the main `db:seed`, which calls `seedBillingCatalogFromEnv` when those vars are present.
- Checkout and customer subscription UI require at least one active `BillingPlanPrice` with a non-null `paddlePriceId`.

## Webhook / promo rate limits

- Paddle webhook: sliding window per IP in `apps/web/lib/billing/webhook-rate-limit.ts`.
- `validatePromoCodeAction`: per-org + IP window in `apps/web/lib/billing/promo-rate-limit.ts` to limit abuse.
