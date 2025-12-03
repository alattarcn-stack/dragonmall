import { describe, it, expect, beforeEach } from 'vitest'
import { PaymentService, OrderService } from '../services/payment.service'
import { MockD1Database } from './utils/mock-d1'

describe('Refund Service', () => {
  let db: MockD1Database
  let paymentService: PaymentService
  let orderService: OrderService

  beforeEach(() => {
    db = new MockD1Database()
    paymentService = new PaymentService(db as any)
    orderService = new OrderService(db as any)

    // Create tables
    db.exec(`
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
      )
    `)

    db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        customer_email TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        amount INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `)

    db.exec(`
      CREATE TABLE IF NOT EXISTS refunds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id INTEGER NOT NULL,
        order_id INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_refund_id TEXT,
        status TEXT NOT NULL,
        reason TEXT,
        created_at INTEGER NOT NULL
      )
    `)

    db.exec(`
      CREATE TABLE IF NOT EXISTS downloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        download_url TEXT NOT NULL,
        expires_at INTEGER
      )
    `)
  })

  describe('createRefundRecord', () => {
    it('should create a refund record', async () => {
      const now = Math.floor(Date.now() / 1000)
      
      // Create payment
      db.exec(`
        INSERT INTO payments (transaction_number, order_id, amount, currency, method, status, created_at)
        VALUES ('TXN-123', 1, 10000, 'usd', 'stripe', 'paid', ${now})
      `)

      const payment = await paymentService.getByTransactionNumber('TXN-123')
      expect(payment).not.toBeNull()

      const refund = await paymentService.createRefundRecord(
        payment!.id,
        1,
        10000,
        'usd',
        'stripe',
        're_123456',
        'succeeded',
        'Customer requested refund'
      )

      expect(refund).toBeDefined()
      expect(refund.amount).toBe(10000)
      expect(refund.status).toBe('succeeded')
      expect(refund.providerRefundId).toBe('re_123456')
      expect(refund.reason).toBe('Customer requested refund')
    })
  })

  describe('getRefundsByPaymentId', () => {
    it('should get all refunds for a payment', async () => {
      const now = Math.floor(Date.now() / 1000)
      
      db.exec(`
        INSERT INTO payments (transaction_number, order_id, amount, currency, method, status, created_at)
        VALUES ('TXN-123', 1, 10000, 'usd', 'stripe', 'paid', ${now})
      `)

      const payment = await paymentService.getByTransactionNumber('TXN-123')
      
      await paymentService.createRefundRecord(
        payment!.id,
        1,
        10000,
        'usd',
        'stripe',
        're_123456',
        'succeeded',
        null
      )

      const refunds = await paymentService.getRefundsByPaymentId(payment!.id)
      expect(refunds).toHaveLength(1)
      expect(refunds[0].amount).toBe(10000)
    })
  })

  describe('markOrderRefunded', () => {
    it('should mark order as refunded and expire downloads', async () => {
      const now = Math.floor(Date.now() / 1000)
      
      // Create order
      db.exec(`
        INSERT INTO orders (customer_email, quantity, amount, status, created_at)
        VALUES ('test@example.com', 1, 10000, 'completed', ${now})
      `)

      // Create download
      db.exec(`
        INSERT INTO downloads (order_id, product_id, download_url, expires_at)
        VALUES (1, 1, 'https://example.com/download', NULL)
      `)

      const order = await orderService.getById(1)
      expect(order?.status).toBe('completed')

      const refundedOrder = await orderService.markOrderRefunded(1)
      expect(refundedOrder.status).toBe('refunded')

      // Check download is expired
      const download = await db.prepare('SELECT expires_at FROM downloads WHERE order_id = ?').bind(1).first<{ expires_at: number }>()
      expect(download?.expires_at).toBeLessThanOrEqual(now)
    })
  })
})

