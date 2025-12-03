# Payment Integration Setup Guide

This document explains how to set up Stripe and PayPal payment integrations for Dragon Station 2026.

## Environment Variables

### Required for Stripe

1. **STRIPE_SECRET_KEY** (Secret)
   - Get from: https://dashboard.stripe.com/apikeys
   - Use test key for development, live key for production
   - Set via: `wrangler secret put STRIPE_SECRET_KEY`

2. **STRIPE_WEBHOOK_SECRET** (Secret)
   - Get from: https://dashboard.stripe.com/webhooks
   - Create webhook endpoint: `https://your-api-domain.com/api/payments/stripe/webhook`
   - Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
   - Set via: `wrangler secret put STRIPE_WEBHOOK_SECRET`

3. **STRIPE_PUBLISHABLE_KEY** (Public)
   - Get from: https://dashboard.stripe.com/apikeys
   - Add to `wrangler.toml` `[vars]` section or set as secret
   - Also set as `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in frontend

### Required for PayPal

1. **PAYPAL_CLIENT_ID** (Secret)
   - Get from: https://developer.paypal.com/dashboard/applications
   - Use sandbox credentials for development
   - Set via: `wrangler secret put PAYPAL_CLIENT_ID`

2. **PAYPAL_CLIENT_SECRET** (Secret)
   - Get from: https://developer.paypal.com/dashboard/applications
   - Use sandbox credentials for development
   - Set via: `wrangler secret put PAYPAL_CLIENT_SECRET`

### Other Variables

- **FRONTEND_URL**: Your frontend domain (e.g., `https://store.dragonstation.com`)
- **ENVIRONMENT**: `development` or `production`

## Setting Secrets in Cloudflare

### Local Development

For local development, create a `.dev.vars` file in `dragon-2026/infra/`:

```toml
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
FRONTEND_URL=http://localhost:3000
ENVIRONMENT=development
```

### Production

Set secrets using Wrangler CLI:

```bash
cd dragon-2026/infra
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put STRIPE_PUBLISHABLE_KEY
wrangler secret put PAYPAL_CLIENT_ID
wrangler secret put PAYPAL_CLIENT_SECRET
```

## Frontend Environment Variables

In `apps/store/.env.local`:

```env
NEXT_PUBLIC_API_URL=https://api.dragonstation.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

## Stripe Webhook Setup

1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Enter your webhook URL: `https://your-api-domain.com/api/payments/stripe/webhook`
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copy the webhook signing secret
6. Set it as `STRIPE_WEBHOOK_SECRET`

## PayPal Webhook Setup

1. Go to https://developer.paypal.com/dashboard/applications
2. Navigate to your app → Webhooks
3. Add webhook URL: `https://your-api-domain.com/api/payments/paypal/webhook`
4. Select events:
   - `PAYMENT.CAPTURE.COMPLETED`
5. Configure webhook in PayPal dashboard

## Database Migration

After updating the payments schema, run:

```bash
cd dragon-2026
npm run db:migrate:remote
```

## Testing

### Stripe Test Cards

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

### PayPal Sandbox

Use PayPal sandbox accounts for testing:
- https://developer.paypal.com/dashboard/accounts

## Multi-Currency Support

The payment system supports multiple currencies:

- Currency is stored in the `payments` table
- Default currency: `usd`
- Supported currencies: Any ISO 4217 code (usd, eur, gbp, cad, aud, etc.)
- Stripe automatically handles currency conversion
- PayPal supports multiple currencies based on account settings

## Apple Pay / Google Pay

Stripe automatically enables Apple Pay and Google Pay when:
- Using Payment Element (already implemented)
- Domain is verified
- SSL certificate is valid
- Payment methods are available in the customer's region

No additional configuration needed!

## Deployment Checklist

- [ ] Set all required secrets in Cloudflare
- [ ] Configure Stripe webhook endpoint
- [ ] Configure PayPal webhook endpoint
- [ ] Set `FRONTEND_URL` in `wrangler.toml`
- [ ] Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in frontend
- [ ] Run database migration
- [ ] Test payment flow end-to-end
- [ ] Verify webhook delivery in Stripe/PayPal dashboards

