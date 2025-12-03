# Wrangler CLI Setup Guide

This guide explains how to use Wrangler CLI to develop, preview, and deploy the Dragon Station 2026 API Worker.

## Current Project Structure

The project is already set up with Wrangler configuration:
- **Wrangler config**: `infra/wrangler.toml`
- **Worker entry point**: `infra/api-worker/src/worker.ts`
- **Main entry point**: `infra/api-worker/src/index.ts`

## Prerequisites

1. **Install Wrangler CLI** (if not already installed):
   ```bash
   npm install -g wrangler
   # Or use npx (no installation needed)
   npx wrangler --version
   ```

2. **Authenticate with Cloudflare**:
   ```bash
   wrangler login
   ```
   This will open your browser to authenticate with Cloudflare.

## Development Commands

### Start Local Development Server

```bash
# From project root
npm run dev:worker

# Or directly with wrangler
cd infra
wrangler dev
```

The worker will be available at `http://localhost:8787`

### Preview with Remote Resources

```bash
cd infra
wrangler dev --remote
```

This uses your production D1 database, R2 bucket, etc. (be careful!)

## Deployment Commands

### Deploy API Worker

```bash
# From project root
cd infra
wrangler deploy

# Or from root with config path
wrangler deploy --config infra/wrangler.toml
```

### Deploy with Environment

```bash
cd infra
wrangler deploy --env production
```

## Configuration

The `infra/wrangler.toml` file contains:

- **Worker name**: `dragon-station-2026-api`
- **Entry point**: `api-worker/src/worker.ts`
- **D1 Database binding**: `D1_DATABASE`
- **R2 Bucket binding**: `R2_BUCKET`
- **KV Namespace binding**: `KV_SESSIONS`
- **Queue binding**: `QUEUE_WEBHOOKS`

## Setting Secrets

Secrets are set via Wrangler CLI (not in `wrangler.toml`):

```bash
cd infra

# JWT Secret (REQUIRED)
wrangler secret put JWT_SECRET

# Stripe (if using)
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put STRIPE_PUBLISHABLE_KEY

# PayPal (if using)
wrangler secret put PAYPAL_CLIENT_ID
wrangler secret put PAYPAL_CLIENT_SECRET
wrangler secret put PAYPAL_WEBHOOK_ID

# Email (if using)
wrangler secret put EMAIL_PROVIDER
wrangler secret put EMAIL_API_KEY
wrangler secret put EMAIL_FROM
wrangler secret put FRONTEND_BASE_URL

# Other
wrangler secret put SEED_SECRET  # Development only
wrangler secret put SENTRY_DSN   # Optional
```

## List Secrets

```bash
cd infra
wrangler secret list
```

## Database Management

### Run Migrations

```bash
# Local database
npm run db:migrate

# Production database
npm run db:migrate:prod

# Or directly
cd infra
wrangler d1 execute dragon-station-db --file=../db/schema.sql
wrangler d1 execute dragon-station-db --remote --file=../db/schema.sql
```

### Query Database

```bash
cd infra
wrangler d1 execute dragon-station-db --command "SELECT * FROM users LIMIT 10"
wrangler d1 execute dragon-station-db --remote --command "SELECT * FROM users LIMIT 10"
```

## View Logs

```bash
cd infra
wrangler tail
```

This streams real-time logs from your deployed worker.

## Common Wrangler Commands

```bash
# Check authentication
wrangler whoami

# List all workers
wrangler deployments list

# View worker info
wrangler deployments list --name dragon-station-2026-api

# Delete a deployment
wrangler deployments delete <deployment-id>

# View KV namespaces
wrangler kv:namespace list

# View R2 buckets
wrangler r2 bucket list

# View D1 databases
wrangler d1 list
```

## Troubleshooting

### "Missing entry-point" Error

If you see this error, make sure you're running commands from the `infra/` directory or using `--config infra/wrangler.toml`:

```bash
# Correct
cd infra && wrangler deploy

# Or
wrangler deploy --config infra/wrangler.toml
```

### Authentication Issues

```bash
# Re-authenticate
wrangler logout
wrangler login
```

### Configuration Not Found

Make sure `wrangler.toml` exists in `infra/` directory and the path is correct.

## Integration with GitHub Actions

The project also includes GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically deploys on push to `main`. This uses:

```yaml
- uses: cloudflare/wrangler-action@v3
  with:
    workingDirectory: infra
    command: deploy
```

## Next Steps

1. **Set up Cloudflare resources** (D1, R2, KV, Queue) - see `DEPLOYMENT.md`
2. **Set required secrets** using `wrangler secret put`
3. **Run database migrations** using `npm run db:migrate:prod`
4. **Deploy the worker** using `wrangler deploy`
5. **Deploy frontend apps** to Cloudflare Pages (separate from Workers)

## Resources

- [Wrangler Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Wrangler Commands Reference](https://developers.cloudflare.com/workers/wrangler/commands/)
- [wrangler.toml Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)

