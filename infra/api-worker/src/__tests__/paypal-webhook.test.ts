import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Env } from '../types'
import { createPaymentsRouter } from '../routes/payments'
import { createTestEnv } from './utils/test-helpers'
import { verifyPayPalWebhook, extractPayPalHeaders } from '../utils/paypal-webhook'
import { Hono } from 'hono'

// Mock the verification function for testing
vi.mock('../utils/paypal-webhook', () => ({
  verifyPayPalWebhook: vi.fn(),
  extractPayPalHeaders: vi.fn(),
}))

describe('PayPal Webhook Verification', () => {
  let env: Env
  let router: ReturnType<typeof createPaymentsRouter>

  beforeEach(async () => {
    env = createTestEnv()
    env.PAYPAL_CLIENT_ID = 'test_client_id'
    env.PAYPAL_CLIENT_SECRET = 'test_client_secret'
    env.PAYPAL_WEBHOOK_ID = 'test_webhook_id'
    env.ENVIRONMENT = 'development'

    // Set up database schema
    await env.D1_DATABASE.exec(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_number TEXT UNIQUE NOT NULL,
        external_transaction_id TEXT,
        user_id INTEGER,
        order_id INTEGER,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'usd',
        method TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        paid_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        customer_email TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        amount INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        price INTEGER NOT NULL
      );
    `)

    router = createPaymentsRouter(env)
  })

  describe('Valid webhook signature', () => {
    it('should process webhook when signature is valid', async () => {
      // Create a test payment and order
      const orderId = 1
      const paymentId = 1
      await env.D1_DATABASE.exec(`
        INSERT INTO orders (id, customer_email, quantity, amount, status, created_at)
        VALUES (${orderId}, 'test@example.com', 1, 10000, 'pending', ${Math.floor(Date.now() / 1000)})
      `)
      await env.D1_DATABASE.exec(`
        INSERT INTO payments (id, transaction_number, external_transaction_id, order_id, amount, method, status, created_at)
        VALUES (${paymentId}, 'TXN-123', 'PAYPAL-ORDER-123', ${orderId}, 10000, 'paypal', 'pending', ${Math.floor(Date.now() / 1000)})
      `)

      // Mock valid verification
      vi.mocked(verifyPayPalWebhook).mockResolvedValue(true)
      vi.mocked(extractPayPalHeaders).mockReturnValue({
        'paypal-transmission-id': 'test-transmission-id',
        'paypal-transmission-time': '2024-01-01T00:00:00Z',
        'paypal-transmission-sig': 'test-sig',
        'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/test',
        'paypal-auth-algo': 'SHA256withRSA',
      })

      const webhookBody = JSON.stringify({
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'CAPTURE-123',
          supplementary_data: {
            related_ids: {
              order_id: 'PAYPAL-ORDER-123',
            },
          },
        },
      })

      const req = new Request('http://localhost/api/payments/paypal/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'paypal-transmission-id': 'test-transmission-id',
          'paypal-transmission-time': '2024-01-01T00:00:00Z',
          'paypal-transmission-sig': 'test-sig',
          'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/test',
          'paypal-auth-algo': 'SHA256withRSA',
        },
        body: webhookBody,
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.received).toBe(true)
      expect(verifyPayPalWebhook).toHaveBeenCalled()
    })
  })

  describe('Invalid webhook signature', () => {
    it('should reject webhook when signature is invalid', async () => {
      // Mock invalid verification
      vi.mocked(verifyPayPalWebhook).mockResolvedValue(false)
      vi.mocked(extractPayPalHeaders).mockReturnValue({
        'paypal-transmission-id': 'test-transmission-id',
        'paypal-transmission-time': '2024-01-01T00:00:00Z',
        'paypal-transmission-sig': 'invalid-sig',
        'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/test',
        'paypal-auth-algo': 'SHA256withRSA',
      })

      const webhookBody = JSON.stringify({
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'CAPTURE-123',
        },
      })

      const req = new Request('http://localhost/api/payments/paypal/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'paypal-transmission-id': 'test-transmission-id',
          'paypal-transmission-time': '2024-01-01T00:00:00Z',
          'paypal-transmission-sig': 'invalid-sig',
          'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/test',
          'paypal-auth-algo': 'SHA256withRSA',
        },
        body: webhookBody,
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.error).toBe('Invalid webhook signature')
      expect(verifyPayPalWebhook).toHaveBeenCalled()
    })

    it('should reject webhook when signature verification throws error', async () => {
      // Mock verification throwing error
      vi.mocked(verifyPayPalWebhook).mockRejectedValue(new Error('Verification failed'))
      vi.mocked(extractPayPalHeaders).mockReturnValue({
        'paypal-transmission-id': 'test-transmission-id',
        'paypal-transmission-time': '2024-01-01T00:00:00Z',
        'paypal-transmission-sig': 'test-sig',
        'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/test',
        'paypal-auth-algo': 'SHA256withRSA',
      })

      const webhookBody = JSON.stringify({
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
      })

      const req = new Request('http://localhost/api/payments/paypal/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: webhookBody,
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(500)
      expect(data.error).toBe('Webhook processing failed')
    })
  })

  describe('Missing configuration', () => {
    it('should return 500 when PAYPAL_WEBHOOK_ID is not configured', async () => {
      const envWithoutWebhookId = {
        ...env,
        PAYPAL_WEBHOOK_ID: undefined,
      }

      const req = new Request('http://localhost/api/payments/paypal/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event_type: 'PAYMENT.CAPTURE.COMPLETED' }),
      })

      const routerWithoutWebhookId = createPaymentsRouter(envWithoutWebhookId)
      const res = await routerWithoutWebhookId.fetch(req, envWithoutWebhookId, {} as any)
      const data = await res.json()

      expect(res.status).toBe(500)
      expect(data.error).toBe('Webhook verification not configured')
    })

    it('should return 500 when PayPal credentials are not configured', async () => {
      const envWithoutCreds = {
        ...env,
        PAYPAL_CLIENT_ID: undefined,
        PAYPAL_CLIENT_SECRET: undefined,
      }

      const req = new Request('http://localhost/api/payments/paypal/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event_type: 'PAYMENT.CAPTURE.COMPLETED' }),
      })

      const routerWithoutCreds = createPaymentsRouter(envWithoutCreds)
      const res = await routerWithoutCreds.fetch(req, envWithoutCreds, {} as any)
      const data = await res.json()

      expect(res.status).toBe(500)
      expect(data.error).toBe('PayPal credentials not configured')
    })
  })

  describe('Missing headers', () => {
    it('should reject webhook when required headers are missing', async () => {
      // Mock verification returning false (headers missing)
      vi.mocked(verifyPayPalWebhook).mockResolvedValue(false)
      vi.mocked(extractPayPalHeaders).mockReturnValue({
        'paypal-transmission-id': '',
        'paypal-transmission-time': '',
        'paypal-transmission-sig': '',
        'paypal-cert-url': '',
        'paypal-auth-algo': '',
      })

      const req = new Request('http://localhost/api/payments/paypal/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event_type: 'PAYMENT.CAPTURE.COMPLETED' }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.error).toBe('Invalid webhook signature')
    })
  })
})

