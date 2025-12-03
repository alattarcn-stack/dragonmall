# Deployment Guide

This guide walks you through deploying Dragon Station 2026 to Cloudflare.

## Quick Deploy (Recommended)

### Option 1: One-Click Deploy Button

1. **Fork this repository** to your GitHub account
2. **Click the "Deploy to Cloudflare" button** in the README
3. **Follow the setup wizard** to connect your Cloudflare account
4. **Configure secrets** in Cloudflare Dashboard (see below)
5. **Set up resources** (D1, R2, KV, Queue) - see steps below
6. **Run migrations** and **deploy**

### Option 2: GitHub Actions (Automated)

If you've forked the repo and set up GitHub Actions:

1. **Add GitHub Secrets**:
   - `CLOUDFLARE_API_TOKEN` - Get from [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
     - Create token with: `Account.Cloudflare Workers:Edit` and `Zone.Cloudflare Pages:Edit` permissions
   - `CLOUDFLARE_ACCOUNT_ID` - Found in Cloudflare Dashboard → Right sidebar
   - `NEXT_PUBLIC_API_URL` - Your Worker URL (e.g., `https://dragon-station-2026-api.your-subdomain.workers.dev`)

2. **Push to main branch** - GitHub Actions will automatically deploy all components

## Manual Deployment

### Prerequisites

- Cloudflare account
- Wrangler CLI installed: `npm install -g wrangler`
- Authenticated with Cloudflare: `wrangler login`

### Step 1: Create Cloudflare Resources

#### D1 Database

```bash
# Create database
wrangler d1 create dragon-station-db

# Copy the database_id from output and add to infra/wrangler.toml
# Example output:
# ✅ Created database dragon-station-db in region WEUR
# 
# [[d1_databases]]
# binding = "D1_DATABASE"
# database_name = "dragon-station-db"
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

#### R2 Bucket

```bash
# Create bucket
wrangler r2 bucket create dragon-station-assets
```

#### KV Namespace

```bash
# Create KV namespace
wrangler kv:namespace create KV_SESSIONS

# Copy the id from output and add to infra/wrangler.toml
# Example:
# [[kv_namespaces]]
# binding = "KV_SESSIONS"
# id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Create preview namespace (for local dev)
wrangler kv:namespace create KV_SESSIONS --preview
# Copy preview_id and add to infra/wrangler.toml
```

#### Queue

```bash
# Create queue
wrangler queues create webhook-queue
```

### Step 2: Configure Secrets

Set all required secrets using Wrangler:

```bash
# JWT Secret (REQUIRED)
wrangler secret put JWT_SECRET
# Enter a secure random string (minimum 32 characters)

# Stripe (if using Stripe)
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put STRIPE_PUBLISHABLE_KEY

# PayPal (if using PayPal)
wrangler secret put PAYPAL_CLIENT_ID
wrangler secret put PAYPAL_CLIENT_SECRET

# Email (optional but recommended)
wrangler secret put EMAIL_PROVIDER
wrangler secret put EMAIL_API_KEY
wrangler secret put EMAIL_FROM
wrangler secret put FRONTEND_BASE_URL
```

### Step 3: Run Database Migrations

```bash
# Run migrations on remote database
npm run db:migrate:prod
```

### Step 4: Deploy API Worker

```bash
# Deploy the worker
cd infra
wrangler deploy

# Or from root:
wrangler deploy --config infra/wrangler.toml
```

The worker will be available at: `https://dragon-station-2026-api.your-subdomain.workers.dev`

### Step 5: Deploy Storefront (Cloudflare Pages)

#### Option A: Via Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages**
2. Click **Create application** → **Pages** → **Connect to Git**
3. Select your GitHub repository
4. Configure build settings:
   - **Framework preset**: Next.js
   - **Build command**: `cd apps/store && npm ci && npm run build`
   - **Build output directory**: `apps/store/.next`
   - **Root directory**: `/` (or leave empty)
   - **Deploy command**: (leave empty - Pages auto-deploys the build output)
5. Add environment variables:
   - `NEXT_PUBLIC_API_URL`: Your Worker URL (e.g., `https://dragon-station-2026-api.your-subdomain.workers.dev`)
   - `NEXT_PUBLIC_SENTRY_DSN`: (optional) Sentry DSN for error tracking
6. Click **Save and Deploy**

**⚠️ Important**: Do NOT set a "Deploy command" - Cloudflare Pages automatically deploys the build output. If you see `npx wrangler deploy` in the deploy command field, remove it. That command is only for Workers, not Pages.

#### Option B: Via Wrangler (Pages)

```bash
# Build the storefront
cd apps/store
npm ci
npm run build

# Deploy to Pages
wrangler pages deploy .next \
  --project-name=dragon-station-store \
  --compatibility-date=2024-01-01
```

### Step 6: Deploy Admin Panel (Cloudflare Pages)

Same process as storefront, but with different settings:

1. **Build command**: `cd apps/admin && npm ci && npm run build`
2. **Build output directory**: `apps/admin/.next`
3. **Project name**: `dragon-station-admin`
4. **Environment variables**: Same as storefront

### Step 7: Create Initial Admin User

**⚠️ SECURITY**: The `/api/admin/seed` endpoint is **automatically blocked in production** and requires `SEED_SECRET` even in development.

**For Production**: Create admin users manually via database or use a secure migration script. The seed endpoint will return 403 in production.

**For Development/Staging** (if needed):
1. Set `SEED_SECRET` in environment variables (NEVER in production)
2. Set `ENVIRONMENT` to something other than `production`
3. Use the endpoint with the secret:

```bash
# Using the deployed worker URL with secret
curl -X POST https://your-worker-url.workers.dev/api/admin/seed \
  -H "Content-Type: application/json" \
  -H "X-Seed-Secret: your-seed-secret-here" \
  -d '{"email": "admin@example.com", "password": "Admin123!"}'
```

**⚠️ CRITICAL**: 
- **NEVER** set `SEED_SECRET` in production environments
- The endpoint automatically rejects requests when `ENVIRONMENT=production`
- Use a strong, random secret and keep it secure
- Consider using database migrations or manual SQL for production admin creation

## Post-Deployment Checklist

- [ ] API worker is accessible and responding
- [ ] Storefront is live and can connect to API
- [ ] Admin panel is live and can login
- [ ] Database migrations completed successfully
- [ ] All secrets configured correctly
- [ ] Stripe/PayPal webhooks configured (if using payments)
- [ ] Email provider configured (if using email)
- [ ] Sentry monitoring configured (optional)
- [ ] Custom domains configured (optional)
- [ ] SSL certificates active (automatic with Cloudflare)

## Custom Domains

### API Worker Custom Domain

1. Add your domain to Cloudflare
2. Go to Workers & Pages → Your Worker → Settings → Triggers
3. Add Custom Domain
4. Follow DNS setup instructions

### Pages Custom Domain

1. Go to Pages project → Custom domains
2. Add your domain
3. Update DNS records as instructed
4. SSL will be provisioned automatically

## Environment Variables Summary

### Worker Secrets (via `wrangler secret put`)
- `JWT_SECRET` (required)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` (if using Stripe)
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` (if using PayPal)
- `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM`, `FRONTEND_BASE_URL` (if using email)
- `SENTRY_DSN` (optional)

### Pages Environment Variables
- `NEXT_PUBLIC_API_URL` (required) - Your Worker URL
- `NEXT_PUBLIC_SENTRY_DSN` (optional)
- `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` (optional, for source maps)

## Troubleshooting

### Worker Deployment Fails

- Check `wrangler.toml` has correct resource IDs
- Verify all secrets are set: `wrangler secret list`
- Check Cloudflare account limits

### Pages Build Fails

- Verify build command and output directory
- Check Node.js version (should be 18+)
- Review build logs in Cloudflare Dashboard

### API Connection Issues

- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check CORS settings in worker
- Verify worker is deployed and accessible

### Database Issues

- Run migrations: `npm run db:migrate:prod`
- Check database binding in `wrangler.toml`
- Verify database exists: `wrangler d1 list`

## Monitoring

After deployment, monitor:
- Worker logs: Cloudflare Dashboard → Workers → Your Worker → Logs
- Pages analytics: Cloudflare Dashboard → Pages → Your Project → Analytics
- Error tracking: Sentry Dashboard (if configured)

## Rollback

### Worker Rollback
```bash
# List deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback [deployment-id]
```

### Pages Rollback
- Go to Pages project → Deployments
- Click on previous deployment → Promote to production
