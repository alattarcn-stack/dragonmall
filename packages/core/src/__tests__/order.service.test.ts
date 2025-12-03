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

