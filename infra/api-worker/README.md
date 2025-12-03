# API Worker

Cloudflare Workers API for Dragon Station 2026, built with Hono.

## Features

- RESTful API endpoints
- JWT-based authentication (admin & customer)
- Payment processing (Stripe/PayPal)
- Webhook handlers with signature verification
- File upload handling with validation
- Rate limiting
- CSRF protection
- Security headers
- Comprehensive error handling
- Health check endpoints
- Audit logging

## Routes

### Public Routes (No Auth Required)

- `GET /health` - Health check with component status
- `GET /api/health` - Health check (alias)
- `GET /api/products` - List products (with search, filter, sort)
- `GET /api/products/:slug` - Get product by slug/ID
- `GET /api/categories` - List categories
- `POST /api/orders` - Create draft order
- `POST /api/auth/signup` - Customer signup
- `POST /api/auth/login` - Customer login
- `POST /api/auth/request-password-reset` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### Protected Routes (Customer Auth Required)

- `GET /api/orders/mine` - Get customer's orders
- `GET /api/downloads/mine` - Get customer's downloads
- `GET /api/orders/:id` - Get order (admin or order owner only)
- `POST /api/orders/:id/pay` - Mark order as paid (admin or order owner)

### Protected Routes (Admin Auth Required)

- `GET /api/admin/dashboard` - Analytics dashboard
- `GET /api/admin/products` - List products (paginated)
- `POST /api/admin/products` - Create product
- `PUT /api/admin/products/:id` - Update product
- `DELETE /api/admin/products/:id` - Delete product
- `POST /api/admin/products/:id/files` - Upload product file
- `GET /api/admin/orders` - List orders (paginated)
- `POST /api/admin/orders/:id/refund` - Process refund
- `GET /api/admin/inventory` - List inventory (paginated)
- `POST /api/admin/inventory` - Add inventory items
- `GET /api/admin/support` - List support tickets (paginated)
- `POST /api/admin/support/:id/reply` - Reply to support ticket
- `GET /api/admin/categories` - List categories (paginated)
- `POST /api/admin/categories` - Create category
- `PUT /api/admin/categories/:id` - Update category
- `DELETE /api/admin/categories/:id` - Delete category
- `GET /api/admin/coupons` - List coupons
- `POST /api/admin/coupons` - Create coupon
- `PUT /api/admin/coupons/:id` - Update coupon
- `DELETE /api/admin/coupons/:id` - Delete coupon

### Webhook Routes (Signature Verification)

- `POST /api/payments/stripe/webhook` - Stripe webhook handler
- `POST /api/payments/paypal/webhook` - PayPal webhook handler

### Development Routes (Non-Production Only)

- `POST /api/admin/seed` - Seed initial admin user (requires SEED_SECRET)

## Authentication

### Admin Authentication
- JWT-based authentication
- HTTP-only cookie: `admin_token`
- Token expires after 24 hours
- Middleware: `adminAuth` (requires `role: 'admin'`)

### Customer Authentication
- JWT-based authentication
- HTTP-only cookie: `customer_token`
- Token expires after 30 days
- Middleware: `customerAuth` (requires `role: 'customer'`)

### Optional Authentication
- Middleware: `optionalAuth` (sets user context if authenticated, but doesn't require it)

## Security Features

- **Input Validation**: Zod schemas for all endpoints
- **CSRF Protection**: X-Requested-With header required for state-changing operations
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, CSP, etc.
- **Rate Limiting**: Login attempt throttling with IP hashing
- **File Upload Validation**: MIME type, size, and dangerous extension checks
- **XSS Protection**: HTML sanitization for user-generated content
- **Request Size Limits**: 5MB JSON, 10MB form data
- **Environment Validation**: Comprehensive startup validation
- **Audit Logging**: Sensitive operations logged with full context

## Environment Variables

See [`../ENVIRONMENT.md`](../ENVIRONMENT.md) for complete documentation.

### Required
- `JWT_SECRET` - Minimum 32 characters
- `D1_DATABASE` - D1 database binding
- `R2_BUCKET` - R2 bucket binding
- `KV_SESSIONS` - KV namespace binding
- `QUEUE_WEBHOOKS` - Queue binding

### Optional (Payment Providers)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`

### Optional (Email)
- `EMAIL_PROVIDER` - 'resend' or 'sendgrid'
- `EMAIL_API_KEY` - Email provider API key
- `EMAIL_FROM` - From email address

### Optional (Other)
- `ENVIRONMENT` - 'development', 'staging', or 'production'
- `FRONTEND_URL` - Storefront URL (for CORS)
- `ADMIN_URL` - Admin panel URL (for CORS)
- `SENTRY_DSN` - Sentry error tracking
- `VERSION` - Application version (for health check)

## Development

```bash
# Start development server
npm run dev:worker

# Run tests
npm test

# Type check
npm run type-check
```

## Deployment

```bash
# Deploy to Cloudflare
npm run deploy

# Or use wrangler directly
wrangler deploy --config ../wrangler.toml
```

## Health Check

The health check endpoint (`/health` or `/api/health`) returns:

```json
{
  "status": "ok" | "degraded" | "error",
  "version": "0.1.0",
  "env": "production",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": {
    "database": { "status": "ok" },
    "stripe": { "status": "ok" | "not_configured" },
    "paypal": { "status": "ok" | "not_configured" }
  }
}
```

- **200 OK**: Service is healthy (status: 'ok' or 'degraded')
- **503 Service Unavailable**: Service is unhealthy (status: 'error')

## API Examples

### Health Check

```bash
curl http://localhost:8787/health
```

### List Products

```bash
curl http://localhost:8787/api/products
```

### Create Order

```bash
curl -X POST http://localhost:8787/api/orders \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d '{
    "productId": 1,
    "quantity": 1,
    "customerEmail": "customer@example.com"
  }'
```

### Admin Login

```bash
curl -X POST http://localhost:8787/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d '{
    "email": "admin@example.com",
    "password": "password"
  }'
```

## Testing

Tests are located in `src/__tests__/` and use Vitest with mock D1 database.

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```
