# API Worker

Cloudflare Workers API for Dragon Station 2026, built with Hono.

## Routes

### Public Routes (No Auth Required)

- `GET /health` - Health check
- `GET /api/products` - List products
- `GET /api/products/:slug` - Get product by slug/ID
- `POST /api/orders` - Create draft order

### Protected Routes (Admin Auth Required)

- `GET /api/orders/:id` - Get order details
- `POST /api/orders/:id/pay` - Mark order as paid (internal/webhook)

## Authentication

### Public Auth
Currently allows all requests. No authentication required.

### Admin Auth (Stub)
Placeholder for JWT-based admin authentication. Currently checks for:
- `Authorization: Bearer <token>` header, or
- `admin_token` cookie

**TODO**: Implement proper JWT verification.

### User Auth (Stub)
Placeholder for JWT-based user authentication. Currently checks for:
- `Authorization: Bearer <token>` header, or
- `user_token` cookie

**TODO**: Implement proper JWT verification.

## Environment Variables

Required bindings (configured in `wrangler.toml`):

- `D1_DATABASE` - D1 database instance
- `R2_BUCKET` - R2 bucket for file storage
- `KV_SESSIONS` - KV namespace for sessions
- `QUEUE_WEBHOOKS` - Queue for webhook processing
- `ENVIRONMENT` - Environment name (development/production)

## Development

```bash
npm run dev:worker
```

## Deployment

```bash
npm run deploy
```

## API Examples

### List Products

```bash
curl http://localhost:8787/api/products
```

### Get Product

```bash
curl http://localhost:8787/api/products/1
```

### Create Order

```bash
curl -X POST http://localhost:8787/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 1,
    "quantity": 1,
    "customerEmail": "customer@example.com"
  }'
```

### Get Order (Admin)

```bash
curl http://localhost:8787/api/orders/1 \
  -H "Authorization: Bearer <admin-token>"
```

