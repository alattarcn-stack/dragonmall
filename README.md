# Dragon Station 2026

**Single-store digital products platform on Cloudflare Workers**

A modern, production-ready e-commerce platform for selling digital products, license keys, and services. Built with Next.js, TypeScript, and Cloudflare's edge infrastructure.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/akmobb/dragonmall)

## Core Features

### Customer Features
- **Digital Downloads**: Sell and deliver digital files (PDFs, ZIPs, etc.) via Cloudflare R2
- **License Keys**: Automated license code allocation from inventory
- **Shopping Cart**: Multi-item cart with persistent storage (guest & authenticated)
- **Coupons & Discounts**: Percentage and fixed-amount discount codes with usage limits
- **Customer Accounts**: Sign up, login, view order history, and manage downloads
- **Product Search & Filtering**: Search by name/description, filter by category, sort by price/relevance
- **Password Reset**: Secure email-based password recovery flow

### Admin Features
- **Product Management**: Create/edit products, upload files, manage inventory
- **Category Management**: Organize products with categories
- **Order Management**: View orders, process refunds, track fulfillment
- **Inventory Management**: Add and allocate license codes
- **Coupon Management**: Create and manage discount codes
- **Analytics Dashboard**: Revenue trends, top products, order statistics (last 30 days)
- **Support Tickets**: Customer support ticket system
- **Refund Processing**: Full refunds for Stripe/PayPal payments with automatic download revocation

### Security & Infrastructure
- **Authentication**: JWT-based auth with HTTP-only cookies (admin & customer)
- **Password Security**: bcrypt password hashing with salt rounds
- **Rate Limiting**: Login attempt throttling via Cloudflare KV
- **CSRF Protection**: X-Requested-With header validation
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, CSP, etc.
- **Input Validation**: Zod schema validation on all API endpoints
- **File Upload Validation**: MIME type and size restrictions
- **Error Tracking**: Sentry integration for monitoring
- **Email Notifications**: Order confirmations, password resets, support replies

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ apps/store   │  │ apps/admin   │  │ api-worker   │      │
│  │ (Next.js)    │  │ (Next.js)    │  │ (Hono)       │      │
│  │ Port 3000    │  │ Port 3001    │  │ Port 8787    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                  │
│  ┌─────────────────────────┼──────────────────────────┐    │
│  │         packages/core (Services & Types)            │    │
│  └─────────────────────────┼──────────────────────────┘    │
│                            │                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ D1 DB    │  │ R2       │  │ KV       │  │ Queue    │   │
│  │ (SQLite) │  │ (Files)  │  │ (Sessions│  │ (Webhooks│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Components

- **`apps/store`**: Customer-facing storefront (Next.js)
  - Product browsing, search, filtering
  - Shopping cart and checkout
  - Customer authentication and account pages
  - Order history and downloads

- **`apps/admin`**: Admin panel (Next.js)
  - Product, category, coupon management
  - Order processing and refunds
  - Inventory management
  - Analytics dashboard
  - Support ticket system

- **`infra/api-worker`**: Cloudflare Workers API (Hono)
  - RESTful API endpoints
  - Authentication middleware
  - Payment processing (Stripe/PayPal)
  - Webhook handlers
  - File upload handling

- **`infra/db`**: D1 Database schema & migrations
  - SQLite-compatible schema
  - Migration files for schema changes
  - Production-ready schema with indexes

- **`packages/core`**: Shared domain logic
  - Service layer (UserService, OrderService, PaymentService, etc.)
  - Domain types (User, Order, Product, etc.)
  - Business logic and validation

- **`packages/api`**: Shared API client
  - TypeScript API client for frontend apps
  - Request/response types
  - Error handling

## Quickstart

### Prerequisites

- Node.js 18+
- npm or yarn
- Cloudflare account (for deployment)
- Wrangler CLI: `npm install -g wrangler`

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd dragon-2026

# Install dependencies
npm install
```

### Development Setup

1. **Create Cloudflare Resources**

```bash
# Create D1 database
wrangler d1 create dragon-station-db
# Copy the database_id from output and add to infra/wrangler.toml

# Create R2 bucket
wrangler r2 bucket create dragon-station-assets

# Create KV namespace
wrangler kv:namespace create KV_SESSIONS
# Copy the id from output and add to infra/wrangler.toml

# Create Queue
wrangler queues create webhook-queue
```

2. **Configure Environment Variables**

Create `infra/.dev.vars` for local development:

```toml
JWT_SECRET=dev-jwt-secret-key-minimum-32-characters-long
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
PAYPAL_CLIENT_ID=test_client_id
PAYPAL_CLIENT_SECRET=test_client_secret
EMAIL_PROVIDER=resend
EMAIL_API_KEY=re_...
EMAIL_FROM=noreply@example.com
FRONTEND_BASE_URL=http://localhost:3000
```

See [`infra/ENVIRONMENT.md`](./infra/ENVIRONMENT.md) for complete environment variable documentation.

3. **Run Database Migrations**

```bash
# Local development
npm run db:migrate

# Production (remote)
npm run db:migrate:prod
```

4. **Seed Initial Admin User** (Development Only)

```bash
# Start the API worker first
npm run dev:worker

# In another terminal, seed admin user
curl -X POST http://localhost:8787/api/admin/seed \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "Admin123!"}'
```

5. **Start Development Servers**

```bash
# Terminal 1: API Worker
npm run dev:worker

# Terminal 2: Storefront
npm run dev:store

# Terminal 3: Admin Panel
npm run dev:admin
```

- Storefront: http://localhost:3000
- Admin Panel: http://localhost:3001
- API: http://localhost:8787

## Ready to Run Checklist

- [ ] Install dependencies: `npm install`
- [ ] Create Cloudflare resources (D1, R2, KV, Queue)
- [ ] Configure `infra/wrangler.toml` with resource IDs
- [ ] Create `infra/.dev.vars` with required secrets
- [ ] Run database migrations: `npm run db:migrate`
- [ ] Seed admin user: `POST /api/admin/seed` (dev only)
- [ ] Start API worker: `npm run dev:worker`
- [ ] Start storefront: `npm run dev:store`
- [ ] Start admin panel: `npm run dev:admin`
- [ ] Configure Stripe/PayPal test keys in `.dev.vars`
- [ ] Set up webhook endpoints (see `infra/PAYMENT_SETUP.md`)

## Testing

The project uses [Vitest](https://vitest.dev/) for testing.

### Run Tests

```bash
# Run all tests
npm test

# Watch mode (re-runs on file changes)
npm run test:watch

# With coverage report
npm run test:coverage
```

### Test Coverage

- **Service Tests** (`packages/core/src/__tests__/`):
  - UserService: Authentication, password hashing
  - OrderService: Order creation, payment processing
  - PaymentService: Payment intents, refunds
  - InventoryService: License code allocation
  - CategoryService: Category CRUD operations
  - CouponService: Coupon validation and application

- **API Tests** (`infra/api-worker/src/__tests__/`):
  - Authentication: Admin and customer login/signup
  - Products: Search, filtering, sorting
  - Categories: CRUD operations
  - Cart: Add/remove items, coupon application
  - Dashboard: Analytics aggregation
  - Refunds: Refund processing

All tests use an in-memory mock D1 database for fast, isolated testing.

See [`TESTING.md`](./TESTING.md) for detailed testing documentation.

## Building

```bash
# Build all packages and apps
npm run build

# Type check
npm run type-check
```

## Deployment

### 🚀 One-Click Deploy to Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/akmobb/dragonmall)

**After clicking the deploy button:**

1. **Fork this repository** to your GitHub account (if you haven't already)
2. **Connect your Cloudflare account** when prompted
3. **Follow the setup wizard** to configure your deployment
4. **Set up Cloudflare resources** (D1, R2, KV, Queue) - see [DEPLOYMENT.md](./DEPLOYMENT.md)
5. **Configure required secrets** in Cloudflare Dashboard:
   - `JWT_SECRET` - Generate a secure random string (min 32 chars)
   - `STRIPE_SECRET_KEY` - Your Stripe secret key (if using Stripe)
   - `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
   - `PAYPAL_CLIENT_ID` & `PAYPAL_CLIENT_SECRET` - PayPal credentials (if using PayPal)
   - `EMAIL_API_KEY` - Email provider API key (if using email)
6. **Run database migrations**: `npm run db:migrate:prod`
7. **Deploy frontend apps** via Cloudflare Pages (see below)

**Note**: Replace `yourusername` in the deploy button URL with your GitHub username after forking.

### Automated Deployment (GitHub Actions)

The repository includes a GitHub Actions workflow that automatically deploys on push to `main`:

1. **Add GitHub Secrets**:
   - `CLOUDFLARE_API_TOKEN` - Get from [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
   - `CLOUDFLARE_ACCOUNT_ID` - Found in Cloudflare Dashboard → Right sidebar
   - `NEXT_PUBLIC_API_URL` - Your Worker URL (set after first deployment)

2. **Push to main branch** - GitHub Actions will automatically deploy:
   - API Worker
   - Storefront (Cloudflare Pages)
   - Admin Panel (Cloudflare Pages)

### Quick Deploy Script

Use the provided deployment script:

```bash
# Make script executable (first time only)
chmod +x scripts/deploy.sh

# Run deployment
./scripts/deploy.sh
```

### Manual Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for detailed manual deployment instructions.

**Quick summary:**
1. Set production secrets via `wrangler secret put`
2. Deploy API worker: `wrangler deploy --config infra/wrangler.toml`
3. Deploy Next.js apps to Cloudflare Pages (via GitHub integration or CLI)
4. Configure environment variables in Cloudflare Dashboard

## Documentation

- [`QUICKSTART.md`](./QUICKSTART.md) - Quick start guide for local development
- [`infra/ENVIRONMENT.md`](./infra/ENVIRONMENT.md) - Environment variables reference
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) - Production deployment guide
- [`TESTING.md`](./TESTING.md) - Testing guide
- [`infra/db/README.md`](./infra/db/README.md) - Database setup and migrations
- [`MONITORING.md`](./MONITORING.md) - Sentry monitoring setup
- [`EMAIL.md`](./EMAIL.md) - Email configuration

## Project Status

✅ **Production Ready** - Core features implemented and tested:
- Authentication & authorization
- Product management & inventory
- Shopping cart & checkout
- Payment processing (Stripe/PayPal)
- Coupons & discounts
- Refunds
- Analytics dashboard
- Email notifications
- Security hardening

## License

[To be determined]
