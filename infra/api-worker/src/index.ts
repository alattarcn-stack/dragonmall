import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from './types'
import { publicAuth, adminAuth, customerAuth } from './middleware/auth'
import { securityHeaders } from './middleware/security-headers'
import { csrfProtection } from './middleware/csrf'
import { requestIdMiddleware } from './middleware/request-id'
import { logError } from './utils/logging'
import { createProductsRouter } from './routes/products'
import { createCategoriesRouter } from './routes/categories'
import { createOrdersRouter } from './routes/orders'
import { createPaymentsRouter } from './routes/payments'
import { createAdminRouter } from './routes/admin'
import { createAdminAuthRouter } from './routes/admin-auth'
import { createAdminSeedRouter } from './routes/admin-seed'
import { createCustomerAuthRouter } from './routes/customer-auth'
import { createCustomerRouter } from './routes/customer'
import { createPasswordResetRouter } from './routes/password-reset'
import { createCartRouter } from './routes/cart'

const app = new Hono<{ Bindings: Env }>()

// Request ID middleware (must be first to generate ID for all requests)
app.use('/*', requestIdMiddleware)

// Security headers middleware (applied globally)
app.use('/*', securityHeaders)

// CORS middleware
app.use('/*', cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
}))

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || 'development'
  })
})

// Public API routes (no auth required)
app.use('/api/products/*', publicAuth)
app.use('/api/orders', publicAuth)

// Products API (public)
app.get('/api/products', async (c) => {
  const router = createProductsRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.get('/api/products/:slug', async (c) => {
  const router = createProductsRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

// Categories API (public)
app.get('/api/categories', async (c) => {
  const router = createCategoriesRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

// Orders API - Create (public, but requires CSRF protection)
app.post('/api/orders', csrfProtection, async (c) => {
  const router = createOrdersRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

// Orders API - Get by ID (admin or authenticated user)
app.use('/api/orders/:id', adminAuth)
app.get('/api/orders/:id', async (c) => {
  const router = createOrdersRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

// Orders API - Mark as paid (internal/webhook)
app.post('/api/orders/:id/pay', async (c) => {
  const router = createOrdersRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

// Payments API (require CSRF protection)
app.post('/api/payments/stripe/create-intent', csrfProtection, async (c) => {
  const router = createPaymentsRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.post('/api/payments/stripe/webhook', async (c) => {
  const router = createPaymentsRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.post('/api/payments/paypal/create-order', csrfProtection, async (c) => {
  const router = createPaymentsRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.post('/api/payments/paypal/webhook', async (c) => {
  const router = createPaymentsRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

// Admin Auth (public, but requires CSRF protection for state-changing operations)
app.post('/api/admin/auth/login', csrfProtection, async (c) => {
  const router = createAdminAuthRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.post('/api/admin/auth/logout', csrfProtection, async (c) => {
  const router = createAdminAuthRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.get('/api/admin/auth/me', async (c) => {
  const router = createAdminAuthRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

// Admin Seed (DEV ONLY - remove in production)
app.post('/api/admin/seed', async (c) => {
  const router = createAdminSeedRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

// Customer Auth (public, but requires CSRF protection for state-changing operations)
app.post('/api/auth/signup', csrfProtection, async (c) => {
  const router = createCustomerAuthRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.post('/api/auth/login', csrfProtection, async (c) => {
  const router = createCustomerAuthRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.post('/api/auth/logout', csrfProtection, async (c) => {
  const router = createCustomerAuthRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.get('/api/auth/me', async (c) => {
  const router = createCustomerAuthRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

// Password Reset (public, but requires CSRF protection for state-changing operations)
app.post('/api/auth/request-password-reset', csrfProtection, async (c) => {
  const router = createPasswordResetRouter(c.env)
  const newUrl = new URL(c.req.url)
  newUrl.pathname = '/request-password-reset'
  const newRequest = new Request(newUrl.toString(), c.req.raw)
  return router.fetch(newRequest, c.env, c.executionCtx)
})

app.post('/api/auth/reset-password', csrfProtection, async (c) => {
  const router = createPasswordResetRouter(c.env)
  const newUrl = new URL(c.req.url)
  newUrl.pathname = '/reset-password'
  const newRequest = new Request(newUrl.toString(), c.req.raw)
  return router.fetch(newRequest, c.env, c.executionCtx)
})

// Cart API (public for GET, protected for state-changing operations)
app.get('/api/cart', async (c) => {
  const router = createCartRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.post('/api/cart/items', csrfProtection, async (c) => {
  const router = createCartRouter(c.env)
  const newUrl = new URL(c.req.url)
  newUrl.pathname = '/items'
  const newRequest = new Request(newUrl.toString(), c.req.raw)
  return router.fetch(newRequest, c.env, c.executionCtx)
})

app.put('/api/cart/items/:itemId', csrfProtection, async (c) => {
  const router = createCartRouter(c.env)
  const newUrl = new URL(c.req.url)
  newUrl.pathname = `/items/${c.req.param('itemId')}`
  const newRequest = new Request(newUrl.toString(), {
    ...c.req.raw,
    method: 'PUT',
  })
  return router.fetch(newRequest, c.env, c.executionCtx)
})

app.delete('/api/cart/items/:itemId', csrfProtection, async (c) => {
  const router = createCartRouter(c.env)
  const newUrl = new URL(c.req.url)
  newUrl.pathname = `/items/${c.req.param('itemId')}`
  const newRequest = new Request(newUrl.toString(), {
    ...c.req.raw,
    method: 'DELETE',
  })
  return router.fetch(newRequest, c.env, c.executionCtx)
})

app.post('/api/cart/checkout', csrfProtection, async (c) => {
  const router = createCartRouter(c.env)
  const newUrl = new URL(c.req.url)
  newUrl.pathname = '/checkout'
  const newRequest = new Request(newUrl.toString(), c.req.raw)
  return router.fetch(newRequest, c.env, c.executionCtx)
})

app.post('/api/cart/apply-coupon', csrfProtection, async (c) => {
  const router = createCartRouter(c.env)
  const newUrl = new URL(c.req.url)
  newUrl.pathname = '/apply-coupon'
  const newRequest = new Request(newUrl.toString(), c.req.raw)
  return router.fetch(newRequest, c.env, c.executionCtx)
})

app.delete('/api/cart/remove-coupon', csrfProtection, async (c) => {
  const router = createCartRouter(c.env)
  const newUrl = new URL(c.req.url)
  newUrl.pathname = '/remove-coupon'
  const newRequest = new Request(newUrl.toString(), c.req.raw)
  return router.fetch(newRequest, c.env, c.executionCtx)
})

// Customer API (protected)
app.use('/api/orders/mine', customerAuth)
app.use('/api/downloads/mine', customerAuth)
app.get('/api/orders/mine', async (c) => {
  const router = createCustomerRouter(c.env)
  // Create a new request with the path relative to the router
  const newUrl = new URL(c.req.url)
  newUrl.pathname = '/orders/mine'
  const newRequest = new Request(newUrl.toString(), c.req.raw)
  return router.fetch(newRequest, c.env, c.executionCtx)
})

app.get('/api/downloads/mine', async (c) => {
  const router = createCustomerRouter(c.env)
  // Create a new request with the path relative to the router
  const newUrl = new URL(c.req.url)
  newUrl.pathname = '/downloads/mine'
  const newRequest = new Request(newUrl.toString(), c.req.raw)
  return router.fetch(newRequest, c.env, c.executionCtx)
})

// Admin API (protected)
app.use('/api/admin/*', adminAuth)
app.get('/api/admin/dashboard', async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.get('/api/admin/products', async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.get('/api/admin/products/:id', async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.post('/api/admin/products', csrfProtection, async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.put('/api/admin/products/:id', csrfProtection, async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.delete('/api/admin/products/:id', csrfProtection, async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.post('/api/admin/products/:id/files', csrfProtection, async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.get('/api/admin/orders', async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.get('/api/admin/orders/:id', async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.post('/api/admin/orders/:id/refund', csrfProtection, async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.get('/api/admin/inventory', async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.post('/api/admin/inventory', csrfProtection, async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.get('/api/admin/support', async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.get('/api/admin/support/:id', async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.post('/api/admin/support/:id/reply', csrfProtection, async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

// Admin Categories API
app.get('/api/admin/categories', async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.get('/api/admin/categories/:id', async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.post('/api/admin/categories', csrfProtection, async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.put('/api/admin/categories/:id', csrfProtection, async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.delete('/api/admin/categories/:id', csrfProtection, async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

// Admin Coupons API
app.get('/api/admin/coupons', async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.get('/api/admin/coupons/:id', async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.post('/api/admin/coupons', csrfProtection, async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.put('/api/admin/coupons/:id', csrfProtection, async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

app.delete('/api/admin/coupons/:id', csrfProtection, async (c) => {
  const router = createAdminRouter(c.env)
  return router.fetch(c.req.raw, c.env, c.executionCtx)
})

// Error handling with Sentry integration
app.onError(async (err, c) => {
  const requestId = c.get('requestId')
  const userId = c.get('userId')
  const userRole = c.get('userRole')
  
  // Log error with context
  logError('Unhandled error in request', err, {
    requestId,
    userId,
    userRole,
    route: c.req.path,
    method: c.req.method,
  }, c.env)
  
  // Add context to Sentry if available
  const { isSentryEnabled } = await import('./utils/sentry')
  if (isSentryEnabled(c.env)) {
    const Sentry = await import('@sentry/cloudflare-workers')
    Sentry.setTag('route', c.req.path)
    Sentry.setTag('method', c.req.method)
    if (userId) {
      Sentry.setUser({ id: String(userId), role: userRole })
    }
    if (requestId) {
      Sentry.setTag('request_id', requestId)
    }
    Sentry.captureException(err).catch(() => {
      // Sentry capture failed, ignore
    })
  }
  
  return c.json({ 
    error: 'Internal server error',
    requestId: requestId || undefined,
    message: c.env.ENVIRONMENT === 'development' ? err.message : undefined
  }, 500)
})

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404)
})

export default app
