# Dragon Station 2026 Infrastructure

## Overview

This directory contains the Cloudflare-native infrastructure configuration for Dragon Station 2026.

## Structure

- `wrangler.toml` - Cloudflare Workers configuration
- `api-worker/` - Hono-based API worker implementation
- `db/` - D1 database schema and migrations

## Cloudflare Bindings

### D1 Database
- **Binding**: `D1_DATABASE`
- **Purpose**: Primary SQLite database for all application data
- **Schema**: See `db/schema.sql`

### R2 Bucket
- **Binding**: `R2_BUCKET`
- **Purpose**: Store product images, digital downloads, and other assets

### KV Namespace
- **Binding**: `KV_SESSIONS`
- **Purpose**: Session storage for user authentication

### Queue
- **Binding**: `QUEUE_WEBHOOKS`
- **Purpose**: Process webhooks from Stripe/PayPal asynchronously

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create D1 database:
   ```bash
   wrangler d1 create dragon-station-db
   ```

3. Update `wrangler.toml` with the database ID

4. Run migrations:
   ```bash
   # Local database
   npm run db:migrate
   
   # Remote database
   npm run db:migrate:remote
   
   # Or use the migration script
   npm run db:migrate:script
   ```

5. Create KV namespace:
   ```bash
   wrangler kv:namespace create KV_SESSIONS
   ```

6. Create R2 bucket:
   ```bash
   wrangler r2 bucket create dragon-station-assets
   ```

7. Start development server:
   ```bash
   npm run dev:worker
   ```

## Deployment

```bash
npm run deploy
```

