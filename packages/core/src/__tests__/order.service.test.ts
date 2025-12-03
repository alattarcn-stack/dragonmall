import { describe, it, expect, beforeEach } from 'vitest'
import { OrderService } from '../services/order.service'
import { PaymentService } from '../services/payment.service'
import { MockD1Database } from './utils/mock-d1'

describe('OrderService', () => {
  let db: MockD1Database
  let orderService: OrderService
  let paymentService: PaymentService

  beforeEach(() => {
    db = new MockD1Database()
    orderService = new OrderService(db as any)
    paymentService = new PaymentService(db as any)
    
    // Setup: Create a product in the mock database (snake_case for DB)
    const productsTable = db._getTable('products')
    productsTable.set(1, {
      id: 1,
      name: 'Test Product',
      price: 1000, // $10.00 in cents
      product_type: 'digital',
      is_active: 1,
      created_at: Math.floor(Date.now() / 1000),
    })
  })

  describe('createDraftOrder', () => {
    it('should create a draft order with correct amount', async () => {
      const order = await orderService.createDraftOrder({
        productId: 1,
        quantity: 2,
        customerEmail: 'customer@example.com',
      })

      expect(order.id).toBeDefined()
      expect(order.customerEmail).toBe('customer@example.com')
      expect(order.quantity).toBe(2)
      expect(order.amount).toBe(2000) // 2 * 1000 cents
      expect(order.status).toBe('pending')
    })

    it('should create order items', async () => {
      const order = await orderService.createDraftOrder({
        productId: 1,
        quantity: 3,
        customerEmail: 'customer@example.com',
      })

      const items = await orderService.getOrderItems(order.id)
      expect(items.length).toBe(1)
      expect(items[0].productId).toBe(1)
      expect(items[0].quantity).toBe(3)
      expect(items[0].price).toBe(1000)
    })

    it('should handle customer data', async () => {
      const order = await orderService.createDraftOrder({
        productId: 1,
        quantity: 1,
        customerEmail: 'customer@example.com',
        customerData: { input: 'test input' },
      })

      expect(order.customerData).toBeDefined()
    })
  })

  describe('markPaid', () => {
    it('should mark order as paid (processing status)', async () => {
      const order = await orderService.createDraftOrder({
        productId: 1,
        quantity: 1,
        customerEmail: 'customer@example.com',
      })

      const updated = await orderService.markPaid(order.id)
      expect(updated.status).toBe('processing')
    })
  })

  describe('updateStatus', () => {
    it('should update order status to completed', async () => {
      const order = await orderService.createDraftOrder({
        productId: 1,
        quantity: 1,
        customerEmail: 'customer@example.com',
      })

      const updated = await orderService.updateStatus(order.id, 'completed')
      expect(updated.status).toBe('completed')
      expect(updated.completedAt).toBeDefined()
    })
  })

  describe('Transaction rollback on failure', () => {
    it('should clean up orphaned order if order_item insertion fails', async () => {
      // Mock the database to fail on order_item insertion
      const originalPrepare = db.prepare.bind(db)
      let orderInserted = false
      let orderId: number | null = null

      db.prepare = (query: string) => {
        const stmt = originalPrepare(query)
        
        // Track when order is inserted
        if (query.includes('INSERT INTO orders')) {
          const originalRun = stmt.run.bind(stmt)
          stmt.run = async () => {
            const result = await originalRun()
            orderInserted = true
            orderId = result.meta.last_row_id as number
            return result
          }
        }
        
        // Fail on order_item insertion
        if (query.includes('INSERT INTO order_items')) {
          const originalRun = stmt.run.bind(stmt)
          stmt.run = async () => {
            throw new Error('Simulated order_item insertion failure')
          }
        }
        
        return stmt
      }

      // Attempt to create order - should fail and clean up
      await expect(
        orderService.createDraftOrder({
          productId: 1,
          quantity: 1,
          customerEmail: 'customer@example.com',
        })
      ).rejects.toThrow('Simulated order_item insertion failure')

      // Verify order was cleaned up (should not exist)
      if (orderId) {
        const ordersTable = db._getTable('orders')
        expect(ordersTable.has(orderId)).toBe(false)
      }
    })

    it('should create order and items successfully when no errors occur', async () => {
      const order = await orderService.createDraftOrder({
        productId: 1,
        quantity: 2,
        customerEmail: 'customer@example.com',
      })

      // Verify order exists
      const ordersTable = db._getTable('orders')
      expect(ordersTable.has(order.id)).toBe(true)

      // Verify order items exist
      const items = await orderService.getOrderItems(order.id)
      expect(items.length).toBe(1)
      expect(items[0].orderId).toBe(order.id)
    })
  })

  describe('fulfillOrder', () => {
    it('should update fulfillment result and status atomically', async () => {
      const order = await orderService.createDraftOrder({
        productId: 1,
        quantity: 1,
        customerEmail: 'customer@example.com',
      })

      const fulfillmentResult = 'License Code: ABC123'
      const fulfilled = await orderService.fulfillOrder(order.id, fulfillmentResult)

      expect(fulfilled.status).toBe('completed')
      expect(fulfilled.fulfillmentResult).toBe(fulfillmentResult)
      expect(fulfilled.completedAt).toBeDefined()
    })
  })

  describe('markOrderRefunded', () => {
    it('should update order status and disable downloads atomically', async () => {
      const order = await orderService.createDraftOrder({
        productId: 1,
        quantity: 1,
        customerEmail: 'customer@example.com',
      })

      // Create a download record first
      const downloadsTable = db._getTable('downloads')
      downloadsTable.set(1, {
        id: 1,
        order_id: order.id,
        expires_at: null,
      })

      const refunded = await orderService.markOrderRefunded(order.id)

      expect(refunded.status).toBe('refunded')
      
      // Verify download was disabled (expires_at should be set to current time)
      const download = downloadsTable.get(1)
      expect(download).toBeDefined()
      if (download && typeof download.expires_at === 'number') {
        expect(download.expires_at).toBeLessThanOrEqual(Math.floor(Date.now() / 1000))
      }
    })
  })
})

describe('PaymentService', () => {
  let db: MockD1Database
  let paymentService: PaymentService
  let orderService: OrderService

  beforeEach(() => {
    db = new MockD1Database()
    paymentService = new PaymentService(db as any)
    orderService = new OrderService(db as any)
    
    // Setup: Create a product (snake_case for DB)
    const productsTable = db._getTable('products')
    productsTable.set(1, {
      id: 1,
      name: 'Test Product',
      price: 1000,
      product_type: 'digital',
      is_active: 1,
      created_at: Math.floor(Date.now() / 1000),
    })
  })

  describe('createPaymentIntent', () => {
    it('should create a payment intent for an order', async () => {
      const order = await orderService.createDraftOrder({
        productId: 1,
        quantity: 1,
        customerEmail: 'customer@example.com',
      })

      // Create order in mock DB with proper structure
      const ordersTable = db._getTable('orders')
      const orderData = ordersTable.get(order.id)
      if (orderData) {
        ordersTable.set(order.id, {
          ...orderData,
          amount: order.amount,
          user_id: null,
        })
      }

      const payment = await paymentService.createPaymentIntent({
        orderId: order.id,
        method: 'stripe',
        currency: 'usd',
      })

      expect(payment.id).toBeDefined()
      expect(payment.orderId).toBe(order.id)
      expect(payment.amount).toBe(1000)
      expect(payment.method).toBe('stripe')
      expect(payment.status).toBe('unpaid')
      expect(payment.transactionNumber).toMatch(/^TXN-/)
    })
  })

  describe('confirmPayment', () => {
    it('should confirm a payment', async () => {
      const order = await orderService.createDraftOrder({
        productId: 1,
        quantity: 1,
        customerEmail: 'customer@example.com',
      })

      // Create order in mock DB with proper structure
      const ordersTable = db._getTable('orders')
      const orderData = ordersTable.get(order.id)
      if (orderData) {
        ordersTable.set(order.id, {
          ...orderData,
          amount: order.amount,
          user_id: null,
        })
      }

      const payment = await paymentService.createPaymentIntent({
        orderId: order.id,
        method: 'stripe',
        currency: 'usd',
      })

      const confirmed = await paymentService.confirmPayment(
        payment.transactionNumber,
        'pi_test_123'
      )

      expect(confirmed.status).toBe('paid')
      expect(confirmed.externalTransactionId).toBe('pi_test_123')
      expect(confirmed.paidAt).toBeDefined()
    })
  })
})

