# Environment Variables

This document lists all environment variables required for Dragon Station 2026 production deployment.

## Cloudflare Workers API (infra/api-worker)

These variables are configured in the Cloudflare Workers dashboard or via Wrangler CLI.

### Required Secrets

These must be set using `wrangler secret put` (they are encrypted and not visible in code):

#### JWT_SECRET
- **Purpose**: Secret key for signing and verifying JWT tokens
- **Required**: Yes
- **Format**: String (minimum 32 characters recommended)
- **Set via**: `wrangler secret put JWT_SECRET`
- **Example**: `your-super-secret-jwt-key-minimum-32-characters-long`
- **Where to configure**: Cloudflare Dashboard → Workers → dragon-station-2026-api → Settings → Variables → Secrets

#### STRIPE_SECRET_KEY
- **Purpose**: Stripe API secret key for payment processing
- **Required**: Yes (if using Stripe)
- **Format**: String (starts with `sk_`)
- **Set via**: `wrangler secret put STRIPE_SECRET_KEY`
- **Where to get**: Stripe Dashboard → Developers → API keys → Secret key
- **Where to configure**: Cloudflare Dashboard → Workers → dragon-station-2026-api → Settings → Variables → Secrets

#### STRIPE_WEBHOOK_SECRET
- **Purpose**: Stripe webhook signing secret for verifying webhook requests
- **Required**: Yes (if using Stripe)
- **Format**: String (starts with `whsec_`)
- **Set via**: `wrangler secret put STRIPE_WEBHOOK_SECRET`
- **Where to get**: Stripe Dashboard → Developers → Webhooks → Add endpoint → Signing secret
- **Where to configure**: Cloudflare Dashboard → Workers → dragon-station-2026-api → Settings → Variables → Secrets

#### STRIPE_PUBLISHABLE_KEY
- **Purpose**: Stripe publishable key (used by frontend, but stored in worker for validation)
- **Required**: Yes (if using Stripe)
- **Format**: String (starts with `pk_`)
- **Set via**: `wrangler secret put STRIPE_PUBLISHABLE_KEY`
- **Where to get**: Stripe Dashboard → Developers → API keys → Publishable key
- **Where to configure**: Cloudflare Dashboard → Workers → dragon-station-2026-api → Settings → Variables → Secrets

#### PAYPAL_CLIENT_ID
- **Purpose**: PayPal REST API client ID
- **Required**: Yes (if using PayPal)
- **Format**: String
- **Set via**: `wrangler secret put PAYPAL_CLIENT_ID`
- **Where to get**: PayPal Developer Dashboard → My Apps & Credentials → App → Client ID
- **Where to configure**: Cloudflare Dashboard → Workers → dragon-station-2026-api → Settings → Variables → Secrets

#### PAYPAL_CLIENT_SECRET
- **Purpose**: PayPal REST API client secret
- **Required**: Yes (if using PayPal)
- **Format**: String
- **Set via**: `wrangler secret put PAYPAL_CLIENT_SECRET`
- **Where to get**: PayPal Developer Dashboard → My Apps & Credentials → App → Secret
- **Where to configure**: Cloudflare Dashboard → Workers → dragon-station-2026-api → Settings → Variables → Secrets

**Note**: PayPal webhook verification is handled via the PayPal SDK using the client credentials. No separate webhook secret is required.

### Optional Secrets

#### MAX_FILE_SIZE
- **Purpose**: Maximum file size for uploads in bytes
- **Required**: No (default: 104857600 = 100MB)
- **Format**: String (number as string)
- **Set via**: `wrangler secret put MAX_FILE_SIZE`
- **Example**: `"104857600"` (100MB)
- **Where to configure**: Cloudflare Dashboard → Workers → dragon-station-2026-api → Settings → Variables → Secrets

#### ALLOWED_FILE_TYPES
- **Purpose**: Comma-separated list of allowed MIME types for file uploads
- **Required**: No (default: common file types)
- **Format**: String (comma-separated)
- **Set via**: `wrangler secret put ALLOWED_FILE_TYPES`
- **Example**: `"application/pdf,application/zip,application/octet-stream"`
- **Where to configure**: Cloudflare Dashboard → Workers → dragon-station-2026-api → Settings → Variables → Secrets

#### SENTRY_DSN
- **Purpose**: Sentry DSN for error tracking and monitoring (API worker)
- **Required**: No (but recommended for production)
- **Format**: String (Sentry DSN URL)
- **Set via**: `wrangler secret put SENTRY_DSN`
- **Where to get**: Sentry Dashboard → Settings → Projects → [Your Project] → Client Keys (DSN)
- **Where to configure**: Cloudflare Dashboard → Workers → dragon-station-2026-api → Settings → Variables → Secrets

#### EMAIL_PROVIDER
- **Purpose**: Email provider to use ('resend' or 'sendgrid')
- **Required**: No (defaults to 'resend')
- **Format**: String
- **Set via**: `wrangler secret put EMAIL_PROVIDER`
- **Example**: `"resend"`
- **Where to configure**: Cloudflare Dashboard → Workers → dragon-station-2026-api → Settings → Variables → Secrets

#### EMAIL_API_KEY
- **Purpose**: API key for email provider
- **Required**: Yes (if sending emails)
- **Format**: String
- **Set via**: `wrangler secret put EMAIL_API_KEY`
- **Where to get**: 
  - Resend: Dashboard → API Keys
  - SendGrid: Settings → API Keys
- **Where to configure**: Cloudflare Dashboard → Workers → dragon-station-2026-api → Settings → Variables → Secrets

#### EMAIL_FROM
- **Purpose**: From email address for all emails
- **Required**: No (defaults to 'noreply@example.com')
- **Format**: String (email address)
- **Set via**: `wrangler secret put EMAIL_FROM`
- **Example**: `"noreply@dragonstation.com"`
- **Where to configure**: Cloudflare Dashboard → Workers → dragon-station-2026-api → Settings → Variables → Secrets

#### FRONTEND_BASE_URL
- **Purpose**: Base URL for frontend (used in email links)
- **Required**: No (falls back to FRONTEND_URL or 'http://localhost:3000')
- **Format**: String (URL)
- **Set via**: `wrangler secret put FRONTEND_BASE_URL` or in `wrangler.toml` as `[vars]`
- **Example**: `"https://store.dragonstation.com"`
- **Where to configure**: Cloudflare Dashboard → Workers → dragon-station-2026-api → Settings → Variables → Secrets or Variables

### Public Variables

These are set in `wrangler.toml` under `[vars]` or in the Cloudflare Dashboard:

#### ENVIRONMENT
- **Purpose**: Environment identifier (development, staging, production)
- **Required**: No (default: "development")
- **Format**: String
- **Set in**: `wrangler.toml` or Cloudflare Dashboard
- **Example**: `"production"`

#### FRONTEND_URL
- **Purpose**: Base URL of the frontend application (for CORS)
- **Required**: No (default: "http://localhost:3000")
- **Format**: String (URL)
- **Set in**: `wrangler.toml` or Cloudflare Dashboard
- **Example**: `"https://store.dragonstation.com"`

## Cloudflare Pages (apps/store & apps/admin)

These variables are configured in the Cloudflare Pages dashboard.

### apps/store

#### NEXT_PUBLIC_API_URL
- **Purpose**: Base URL of the API worker
- **Required**: Yes
- **Format**: String (URL)
- **Where to configure**: Cloudflare Pages Dashboard → store → Settings → Environment variables
- **Example (production)**: `"https://dragon-station-2026-api.your-subdomain.workers.dev"`
- **Example (custom domain)**: `"https://api.dragonstation.com"`

#### NEXT_PUBLIC_SENTRY_DSN
- **Purpose**: Sentry DSN for client-side error tracking
- **Required**: No (but recommended for production)
- **Format**: String (Sentry DSN URL)
- **Where to configure**: Cloudflare Pages Dashboard → store → Settings → Environment variables
- **Where to get**: Sentry Dashboard → Settings → Projects → [Your Project] → Client Keys (DSN)
- **Note**: Must be prefixed with `NEXT_PUBLIC_` to be available in the browser

#### SENTRY_DSN
- **Purpose**: Sentry DSN for server-side error tracking
- **Required**: No (but recommended for production)
- **Format**: String (Sentry DSN URL)
- **Where to configure**: Cloudflare Pages Dashboard → store → Settings → Environment variables
- **Where to get**: Sentry Dashboard → Settings → Projects → [Your Project] → Client Keys (DSN)

#### SENTRY_ORG
- **Purpose**: Sentry organization slug (for source map uploads)
- **Required**: No (only needed if uploading source maps)
- **Format**: String
- **Where to configure**: Cloudflare Pages Dashboard → store → Settings → Environment variables
- **Where to get**: Sentry Dashboard → Settings → Organization Settings → Slug

#### SENTRY_PROJECT
- **Purpose**: Sentry project slug (for source map uploads)
- **Required**: No (only needed if uploading source maps)
- **Format**: String
- **Where to configure**: Cloudflare Pages Dashboard → store → Settings → Environment variables
- **Where to get**: Sentry Dashboard → Settings → Projects → [Your Project] → Slug

### apps/admin

#### NEXT_PUBLIC_API_URL
- **Purpose**: Base URL of the API worker
- **Required**: Yes
- **Format**: String (URL)
- **Where to configure**: Cloudflare Pages Dashboard → admin → Settings → Environment variables
- **Example (production)**: `"https://dragon-station-2026-api.your-subdomain.workers.dev"`
- **Example (custom domain)**: `"https://api.dragonstation.com"`

#### NEXT_PUBLIC_SENTRY_DSN
- **Purpose**: Sentry DSN for client-side error tracking
- **Required**: No (but recommended for production)
- **Format**: String (Sentry DSN URL)
- **Where to configure**: Cloudflare Pages Dashboard → admin → Settings → Environment variables
- **Where to get**: Sentry Dashboard → Settings → Projects → [Your Project] → Client Keys (DSN)
- **Note**: Must be prefixed with `NEXT_PUBLIC_` to be available in the browser

#### SENTRY_DSN
- **Purpose**: Sentry DSN for server-side error tracking
- **Required**: No (but recommended for production)
- **Format**: String (Sentry DSN URL)
- **Where to configure**: Cloudflare Pages Dashboard → admin → Settings → Environment variables
- **Where to get**: Sentry Dashboard → Settings → Projects → [Your Project] → Client Keys (DSN)

#### SENTRY_ORG
- **Purpose**: Sentry organization slug (for source map uploads)
- **Required**: No (only needed if uploading source maps)
- **Format**: String
- **Where to configure**: Cloudflare Pages Dashboard → admin → Settings → Environment variables
- **Where to get**: Sentry Dashboard → Settings → Organization Settings → Slug

#### SENTRY_PROJECT
- **Purpose**: Sentry project slug (for source map uploads)
- **Required**: No (only needed if uploading source maps)
- **Format**: String
- **Where to configure**: Cloudflare Pages Dashboard → admin → Settings → Environment variables
- **Where to get**: Sentry Dashboard → Settings → Projects → [Your Project] → Slug

## Setting Secrets via Wrangler CLI

### One-time Setup

```bash
# Navigate to project root
cd dragon-2026

# Set JWT secret
wrangler secret put JWT_SECRET
# (You'll be prompted to enter the value)

# Set Stripe keys
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put STRIPE_PUBLISHABLE_KEY

# Set PayPal keys
wrangler secret put PAYPAL_CLIENT_ID
wrangler secret put PAYPAL_CLIENT_SECRET

# Optional: File upload configuration
wrangler secret put MAX_FILE_SIZE
wrangler secret put ALLOWED_FILE_TYPES

# Optional: Sentry error tracking
wrangler secret put SENTRY_DSN
```

### Viewing Secrets

```bash
# List all secrets (names only, not values)
wrangler secret list
```

### Updating Secrets

```bash
# Update a secret (same command as creating)
wrangler secret put SECRET_NAME
```

### Deleting Secrets

```bash
# Delete a secret
wrangler secret delete SECRET_NAME
```

## Setting Variables via Cloudflare Dashboard

### Workers (API)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your account
3. Navigate to **Workers & Pages** → **dragon-station-2026-api**
4. Go to **Settings** → **Variables**
5. Under **Environment Variables**, add/edit variables
6. Under **Secrets**, add/edit secrets (values are encrypted)

### Pages (Frontend Apps)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your account
3. Navigate to **Workers & Pages** → **store** (or **admin**)
4. Go to **Settings** → **Environment variables**
5. Add/edit variables for Production, Preview, or both

## Environment-Specific Configuration

### Development

For local development, create `infra/.dev.vars`:

```toml
JWT_SECRET=dev-jwt-secret-key-minimum-32-characters-long
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
PAYPAL_CLIENT_ID=test_client_id
PAYPAL_CLIENT_SECRET=test_client_secret
MAX_FILE_SIZE=104857600
ALLOWED_FILE_TYPES=application/pdf,application/zip,application/octet-stream
```

**Important**: Add `.dev.vars` to `.gitignore` to avoid committing secrets.

### Production

All production secrets should be set via:
- `wrangler secret put` (for Workers)
- Cloudflare Dashboard (for Pages)

Never commit production secrets to version control.

## Security Best Practices

1. **Never commit secrets** to version control
2. **Use different secrets** for development and production
3. **Rotate secrets regularly**, especially if compromised
4. **Use strong JWT secrets** (minimum 32 characters, random)
5. **Limit access** to secrets (only necessary team members)
6. **Monitor secret usage** via Cloudflare Dashboard
7. **Use environment-specific secrets** (dev, staging, prod)

## Troubleshooting

### Secret Not Found

If you get "secret not found" errors:
1. Verify the secret exists: `wrangler secret list`
2. Check the secret name matches exactly (case-sensitive)
3. Ensure you're deploying to the correct environment

### Variable Not Available

If environment variables aren't available:
1. Check `wrangler.toml` for variable definitions
2. Verify variables are set in Cloudflare Dashboard
3. Restart the worker after setting variables
4. Check environment-specific settings (production vs preview)

