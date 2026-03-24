-- Billing: previous migrations 20260324120000 and 20260324123000 were no-ops (empty or SQL commented as one line). This migration applies the real DDL.

CREATE TYPE "public"."BillingProvider" AS ENUM ('PADDLE');

CREATE TYPE "public"."BillingSubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'UNPAID', 'CANCELED', 'EXPIRED', 'PAUSED', 'MANUAL_ACTIVE', 'MANUAL_LOCKED');

CREATE TYPE "public"."BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

CREATE TYPE "public"."DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

CREATE TYPE "public"."BillingEventProcessStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'IGNORED');

CREATE TYPE "public"."ManualBillingOverrideMode" AS ENUM ('TRIAL_EXTENSION', 'MANUAL_ACTIVE', 'MANUAL_LOCK', 'ENTERPRISE_BYPASS');

CREATE TABLE "public"."billing_plans" (     "id" TEXT NOT NULL,     "org_id" TEXT,     "code" TEXT NOT NULL,     "name" TEXT NOT NULL,     "description" TEXT,     "active" BOOLEAN NOT NULL DEFAULT true,     "is_custom" BOOLEAN NOT NULL DEFAULT false,     "trial_days_default" INTEGER NOT NULL DEFAULT 0,     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,     "updated_at" TIMESTAMP(3) NOT NULL,      CONSTRAINT "billing_plans_pkey" PRIMARY KEY ("id") );

CREATE TABLE "public"."billing_plan_prices" (     "id" TEXT NOT NULL,     "org_id" TEXT,     "billing_plan_id" TEXT NOT NULL,     "provider" "public"."BillingProvider" NOT NULL DEFAULT 'PADDLE',     "interval" "public"."BillingInterval" NOT NULL,     "currency" TEXT NOT NULL DEFAULT 'USD',     "unit_amount" DECIMAL(15,2) NOT NULL,     "paddle_price_id" TEXT,     "active" BOOLEAN NOT NULL DEFAULT true,     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,     "updated_at" TIMESTAMP(3) NOT NULL,      CONSTRAINT "billing_plan_prices_pkey" PRIMARY KEY ("id") );

CREATE TABLE "public"."plan_entitlements" (     "id" TEXT NOT NULL,     "org_id" TEXT,     "billing_plan_id" TEXT NOT NULL,     "feature_key" TEXT NOT NULL,     "value_json" JSONB NOT NULL,     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,     "updated_at" TIMESTAMP(3) NOT NULL,      CONSTRAINT "plan_entitlements_pkey" PRIMARY KEY ("id") );

CREATE TABLE "public"."billing_customers" (     "id" TEXT NOT NULL,     "org_id" TEXT NOT NULL,     "provider" "public"."BillingProvider" NOT NULL DEFAULT 'PADDLE',     "paddle_customer_id" TEXT NOT NULL,     "email" TEXT,     "display_name" TEXT,     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,     "updated_at" TIMESTAMP(3) NOT NULL,      CONSTRAINT "billing_customers_pkey" PRIMARY KEY ("id") );

CREATE TABLE "public"."organization_subscriptions" (     "id" TEXT NOT NULL,     "org_id" TEXT NOT NULL,     "billing_customer_id" TEXT NOT NULL,     "billing_plan_id" TEXT NOT NULL,     "provider" "public"."BillingProvider" NOT NULL DEFAULT 'PADDLE',     "status" "public"."BillingSubscriptionStatus" NOT NULL,     "paddle_subscription_id" TEXT,     "paddle_status" TEXT,     "interval" "public"."BillingInterval" NOT NULL DEFAULT 'MONTHLY',     "trial_start" TIMESTAMP(3),     "trial_end" TIMESTAMP(3),     "current_period_start" TIMESTAMP(3),     "current_period_end" TIMESTAMP(3),     "next_billing_at" TIMESTAMP(3),     "grace_until" TIMESTAMP(3),     "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,     "canceled_at" TIMESTAMP(3),     "expires_at" TIMESTAMP(3),     "metadata" JSONB,     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,     "updated_at" TIMESTAMP(3) NOT NULL,      CONSTRAINT "organization_subscriptions_pkey" PRIMARY KEY ("id") );

CREATE TABLE "public"."promo_codes" (     "id" TEXT NOT NULL,     "code" TEXT NOT NULL,     "description" TEXT,     "discount_type" "public"."DiscountType" NOT NULL,     "amount" DECIMAL(15,2) NOT NULL,     "currency" TEXT,     "max_uses" INTEGER,     "used_count" INTEGER NOT NULL DEFAULT 0,     "first_cycle_only" BOOLEAN NOT NULL DEFAULT false,     "valid_from" TIMESTAMP(3),     "valid_until" TIMESTAMP(3),     "active" BOOLEAN NOT NULL DEFAULT true,     "paddle_discount_id" TEXT,     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,     "updated_at" TIMESTAMP(3) NOT NULL,      CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id") );

CREATE TABLE "public"."promo_code_plan_restrictions" (     "id" TEXT NOT NULL,     "promo_code_id" TEXT NOT NULL,     "billing_plan_id" TEXT NOT NULL,     "interval" "public"."BillingInterval",     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,      CONSTRAINT "promo_code_plan_restrictions_pkey" PRIMARY KEY ("id") );

CREATE TABLE "public"."promo_code_redemptions" (     "id" TEXT NOT NULL,     "promo_code_id" TEXT NOT NULL,     "org_id" TEXT NOT NULL,     "subscription_id" TEXT NOT NULL,     "paddle_transaction_id" TEXT,     "redeemed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,      CONSTRAINT "promo_code_redemptions_pkey" PRIMARY KEY ("id") );

CREATE TABLE "public"."billing_event_logs" (     "id" TEXT NOT NULL,     "org_id" TEXT,     "subscription_id" TEXT,     "provider" "public"."BillingProvider" NOT NULL DEFAULT 'PADDLE',     "event_id" TEXT NOT NULL,     "event_type" TEXT NOT NULL,     "signature_hash" TEXT,     "payload" JSONB NOT NULL,     "status" "public"."BillingEventProcessStatus" NOT NULL DEFAULT 'PENDING',     "process_attempts" INTEGER NOT NULL DEFAULT 0,     "error_message" TEXT,     "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,     "processed_at" TIMESTAMP(3),     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,      CONSTRAINT "billing_event_logs_pkey" PRIMARY KEY ("id") );

CREATE TABLE "public"."subscription_status_history" (     "id" TEXT NOT NULL,     "org_id" TEXT NOT NULL,     "subscription_id" TEXT NOT NULL,     "from_status" "public"."BillingSubscriptionStatus",     "to_status" "public"."BillingSubscriptionStatus" NOT NULL,     "reason" TEXT,     "source" TEXT NOT NULL,     "metadata" JSONB,     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,      CONSTRAINT "subscription_status_history_pkey" PRIMARY KEY ("id") );

CREATE TABLE "public"."manual_billing_overrides" (     "id" TEXT NOT NULL,     "org_id" TEXT NOT NULL,     "mode" "public"."ManualBillingOverrideMode" NOT NULL,     "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,     "ends_at" TIMESTAMP(3),     "reason" TEXT,     "active" BOOLEAN NOT NULL DEFAULT true,     "created_by_user_id" TEXT,     "metadata" JSONB,     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,     "updated_at" TIMESTAMP(3) NOT NULL,      CONSTRAINT "manual_billing_overrides_pkey" PRIMARY KEY ("id") );

CREATE TABLE "public"."billing_documents" (     "id" TEXT NOT NULL,     "org_id" TEXT NOT NULL,     "subscription_id" TEXT NOT NULL,     "provider" "public"."BillingProvider" NOT NULL DEFAULT 'PADDLE',     "document_type" TEXT NOT NULL,     "provider_document_id" TEXT,     "provider_url" TEXT,     "status" TEXT NOT NULL,     "currency" TEXT,     "subtotal" DECIMAL(15,2),     "tax" DECIMAL(15,2),     "total" DECIMAL(15,2),     "issued_at" TIMESTAMP(3),     "due_at" TIMESTAMP(3),     "paid_at" TIMESTAMP(3),     "paddle_transaction_id" TEXT,     "raw_snapshot" JSONB,     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,     "updated_at" TIMESTAMP(3) NOT NULL,      CONSTRAINT "billing_documents_pkey" PRIMARY KEY ("id") );

CREATE UNIQUE INDEX "billing_plans_code_key" ON "public"."billing_plans"("code");

CREATE INDEX "billing_plans_org_id_idx" ON "public"."billing_plans"("org_id");

CREATE INDEX "billing_plans_active_idx" ON "public"."billing_plans"("active");

CREATE UNIQUE INDEX "billing_plan_prices_paddle_price_id_key" ON "public"."billing_plan_prices"("paddle_price_id");

CREATE INDEX "billing_plan_prices_org_id_idx" ON "public"."billing_plan_prices"("org_id");

CREATE INDEX "billing_plan_prices_active_idx" ON "public"."billing_plan_prices"("active");

CREATE UNIQUE INDEX "billing_plan_prices_billing_plan_id_interval_currency_key" ON "public"."billing_plan_prices"("billing_plan_id", "interval", "currency");

CREATE INDEX "plan_entitlements_org_id_idx" ON "public"."plan_entitlements"("org_id");

CREATE UNIQUE INDEX "plan_entitlements_billing_plan_id_feature_key_key" ON "public"."plan_entitlements"("billing_plan_id", "feature_key");

CREATE UNIQUE INDEX "billing_customers_paddle_customer_id_key" ON "public"."billing_customers"("paddle_customer_id");

CREATE INDEX "billing_customers_org_id_idx" ON "public"."billing_customers"("org_id");

CREATE UNIQUE INDEX "billing_customers_org_id_provider_key" ON "public"."billing_customers"("org_id", "provider");

CREATE UNIQUE INDEX "organization_subscriptions_org_id_key" ON "public"."organization_subscriptions"("org_id");

CREATE UNIQUE INDEX "organization_subscriptions_paddle_subscription_id_key" ON "public"."organization_subscriptions"("paddle_subscription_id");

CREATE INDEX "organization_subscriptions_status_next_billing_at_idx" ON "public"."organization_subscriptions"("status", "next_billing_at");

CREATE INDEX "organization_subscriptions_status_trial_end_idx" ON "public"."organization_subscriptions"("status", "trial_end");

CREATE INDEX "organization_subscriptions_status_current_period_end_idx" ON "public"."organization_subscriptions"("status", "current_period_end");

CREATE UNIQUE INDEX "promo_codes_code_key" ON "public"."promo_codes"("code");

CREATE INDEX "promo_codes_active_valid_from_valid_until_idx" ON "public"."promo_codes"("active", "valid_from", "valid_until");

CREATE INDEX "promo_code_plan_restrictions_promo_code_id_idx" ON "public"."promo_code_plan_restrictions"("promo_code_id");

CREATE INDEX "promo_code_plan_restrictions_billing_plan_id_idx" ON "public"."promo_code_plan_restrictions"("billing_plan_id");

CREATE UNIQUE INDEX "promo_code_plan_restrictions_promo_code_id_billing_plan_id__key" ON "public"."promo_code_plan_restrictions"("promo_code_id", "billing_plan_id", "interval");

CREATE INDEX "promo_code_redemptions_org_id_redeemed_at_idx" ON "public"."promo_code_redemptions"("org_id", "redeemed_at");

CREATE INDEX "promo_code_redemptions_promo_code_id_redeemed_at_idx" ON "public"."promo_code_redemptions"("promo_code_id", "redeemed_at");

CREATE UNIQUE INDEX "billing_event_logs_event_id_key" ON "public"."billing_event_logs"("event_id");

CREATE INDEX "billing_event_logs_org_id_received_at_idx" ON "public"."billing_event_logs"("org_id", "received_at");

CREATE INDEX "billing_event_logs_status_received_at_idx" ON "public"."billing_event_logs"("status", "received_at");

CREATE INDEX "subscription_status_history_org_id_created_at_idx" ON "public"."subscription_status_history"("org_id", "created_at");

CREATE INDEX "subscription_status_history_subscription_id_created_at_idx" ON "public"."subscription_status_history"("subscription_id", "created_at");

CREATE INDEX "manual_billing_overrides_org_id_active_mode_idx" ON "public"."manual_billing_overrides"("org_id", "active", "mode");

CREATE INDEX "manual_billing_overrides_ends_at_idx" ON "public"."manual_billing_overrides"("ends_at");

CREATE INDEX "billing_documents_org_id_issued_at_idx" ON "public"."billing_documents"("org_id", "issued_at");

CREATE INDEX "billing_documents_subscription_id_issued_at_idx" ON "public"."billing_documents"("subscription_id", "issued_at");

CREATE INDEX "billing_documents_paddle_transaction_id_idx" ON "public"."billing_documents"("paddle_transaction_id");

ALTER TABLE "public"."billing_plans" ADD CONSTRAINT "billing_plans_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."billing_plan_prices" ADD CONSTRAINT "billing_plan_prices_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."billing_plan_prices" ADD CONSTRAINT "billing_plan_prices_billing_plan_id_fkey" FOREIGN KEY ("billing_plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."plan_entitlements" ADD CONSTRAINT "plan_entitlements_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."plan_entitlements" ADD CONSTRAINT "plan_entitlements_billing_plan_id_fkey" FOREIGN KEY ("billing_plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."billing_customers" ADD CONSTRAINT "billing_customers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_billing_customer_id_fkey" FOREIGN KEY ("billing_customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_billing_plan_id_fkey" FOREIGN KEY ("billing_plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."promo_code_plan_restrictions" ADD CONSTRAINT "promo_code_plan_restrictions_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."promo_code_plan_restrictions" ADD CONSTRAINT "promo_code_plan_restrictions_billing_plan_id_fkey" FOREIGN KEY ("billing_plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."promo_code_redemptions" ADD CONSTRAINT "promo_code_redemptions_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."promo_code_redemptions" ADD CONSTRAINT "promo_code_redemptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."promo_code_redemptions" ADD CONSTRAINT "promo_code_redemptions_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."organization_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."billing_event_logs" ADD CONSTRAINT "billing_event_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."billing_event_logs" ADD CONSTRAINT "billing_event_logs_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."organization_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."subscription_status_history" ADD CONSTRAINT "subscription_status_history_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."subscription_status_history" ADD CONSTRAINT "subscription_status_history_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."organization_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."manual_billing_overrides" ADD CONSTRAINT "manual_billing_overrides_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."billing_documents" ADD CONSTRAINT "billing_documents_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."billing_documents" ADD CONSTRAINT "billing_documents_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."organization_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;