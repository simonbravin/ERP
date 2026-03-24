# Paddle Webhook Runbook

## Endpoint

- `POST /api/payments/paddle/webhook`

## Verification

- Signature header: `paddle-signature`
- Secret: `PADDLE_WEBHOOK_SECRET`

## Idempotency

- `BillingEventLog.eventId` is unique.
- Duplicate already processed events return `200`.

## Recovery

1. Find failed events in `BillingEventLog` with `status=FAILED`.
2. Inspect `errorMessage` and payload.
3. Use superadmin resync action to reconcile subscription status.

## Operational checks

- Health route: `GET /api/payments/paddle/health`
- Ensure env vars:
  - `PADDLE_API_KEY`
  - `PADDLE_WEBHOOK_SECRET`
  - `PADDLE_ENV`
