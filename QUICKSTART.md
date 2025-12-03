# Quick Start Guide - Local Development

## Prerequisites

1. **Node.js 18+** installed
2. **Cloudflare Account** (for Wrangler authentication)
3. **Wrangler CLI** installed globally or via npm

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Authenticate with Cloudflare

```bash
# Login to Cloudflare (opens browser)
wrangler login
```

## Step 3: Create Cloudflare Resources (One-time setup)

```bash
# Create D1 database
wrangler d1 create dragon-station-db
# Copy the database_id from output and add to infra/wrangler.toml

# Create R2 bucket
wrangler r2 bucket create dragon-station-assets

# Create KV namespace
wrangler kv:namespace create KV_SESSIONS
# Copy the id from output and add to infra/wrangler.toml

# Create preview KV namespace (for local dev)
wrangler kv:namespace create KV_SESSIONS --preview
# Copy the preview_id and add to infra/wrangler.toml

# Create Queue
wrangler queues create webhook-queue
```

## Step 4: Configure Environment Variables

The `.dev.vars` file has been created at `infra/.dev.vars` with minimal required variables.

**Required for basic functionality:**
- `JWT_SECRET` - Already set (dev secret)

**Optional (for full functionality):**
- Stripe keys (for payments)
- PayPal keys (for payments)
- Email provider keys (for email notifications)

## Step 5: Run Database Migrations

```bash
# For local development (uses local D1)
npm run db:migrate
```

## Step 6: Seed Admin User (Development Only)

```bash
# Start the API worker first (in one terminal)
npm run dev:worker

# In another terminal, seed admin user
curl -X POST http://localhost:8787/api/admin/seed \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "Admin123!"}'
```

## Step 7: Start Development Servers

You'll need **3 terminal windows**:

### Terminal 1: API Worker
```bash
npm run dev:worker
```
API will be available at: http://localhost:8787

### Terminal 2: Storefront
```bash
npm run dev:store
```
Storefront will be available at: http://localhost:3000

### Terminal 3: Admin Panel
```bash
npm run dev:admin
```
Admin panel will be available at: http://localhost:3001

## Testing the Setup

### 1. Check API Health
```bash
curl http://localhost:8787/health
```

### 2. Check Products API
```bash
curl http://localhost:8787/api/products
```

### 3. Test Admin Login
- Go to http://localhost:3001/admin/login
- Login with: `admin@example.com` / `Admin123!`

### 4. Run Tests
```bash
npm test
```

## Troubleshooting

### Wrangler Authentication Error
If you see authentication errors, run:
```bash
wrangler login
```

### Port Already in Use
If ports 3000, 3001, or 8787 are in use:
- Kill the process: `lsof -ti:8787 | xargs kill`
- Or change ports in package.json scripts

### Database Not Found
Make sure you've:
1. Created the D1 database
2. Added the database_id to `infra/wrangler.toml`
3. Run migrations: `npm run db:migrate`

### Module Not Found Errors
Make sure all dependencies are installed:
```bash
npm install
```

## Next Steps

1. **Create a product** via admin panel
2. **Test checkout flow** on storefront
3. **Add test payment keys** to `.dev.vars` for full payment testing
4. **Configure email** for order confirmations

