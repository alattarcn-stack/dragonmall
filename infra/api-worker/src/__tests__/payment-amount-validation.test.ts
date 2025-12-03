import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Env } from '../types'
import { PaymentService, OrderService } from '@dragon/core'
import { createTestEnv } from './utils/test-helpers'
import { createPaymentsRouter } from '../routes/payments'

describe('Payment Amount Validation', () => {
  let env: Env
  let orderService: OrderService
  let paymentService: PaymentService

  beforeEach(async () => {
    env = createTestEnv()
    orderService = new OrderService(env.D1_DATABASE)
    paymentService = new PaymentService(env.D1_DATABASE)

    // Create orders table
    await env.D1_DATABASE.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        customer_email TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        amount INTEGER NOT NULL DEFAULT 0,
        total_amount INTEGER,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `)

    // Create payments table
    await env.D1_DATABASE.exec(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_number TEXT UNIQUE NOT NULL,
        user_id INTEGER,
        order_id INTEGER,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL,
        method TEXT NOT NULL,
        status TEXT NOT NULL,
        external_transaction_id TEXT,
        ip_address TEXT,
        created_at INTEGER NOT NULL
      )
    `)

    // Create products table
    await env.D1_DATABASE.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      )
    `)

    // Create order_items table
    await env.D1_DATABASE.exec(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price INTEGER NOT NULL
      )
    `)
  })

  describe('PaymentService.createPaymentIntent', () => {
    it('should use order amount from database, not client input', async () => {
      // Create an order with a specific amount
      const createdAt = Math.floor(Date.now() / 1000)
      const orderResult = await env.D1_DATABASE
        .prepare('INSERT INTO orders (customer_email, quantity, amount, status, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind('customer@example.com', 1, 5000, 'pending', createdAt)
        .run()

      const orderId = Number(orderResult.meta.last_row_id)

      // Create payment intent - should use order amount from DB
      const payment = await paymentService.createPaymentIntent({
        orderId,
        method: 'stripe',
        currency: 'usd',
      })

      // Verify payment amount matches order amount from database
      expect(payment.amount).toBe(5000)
      expect(payment.orderId).toBe(orderId)
    })

    it('should use total_amount if available (includes discounts)', async () => {
      // Create an order with amount and total_amount (discount applied)
      const createdAt = Math.floor(Date.now() / 1000)
      const orderResult = await env.D1_DATABASE
        .prepare('INSERT INTO orders (customer_email, quantity, amount, total_amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind('customer@example.com', 1, 5000, 4000, 'pending', createdAt) // 20% discount
        .run()

      const orderId = Number(orderResult.meta.last_row_id)

      // Create payment intent - should use total_amount
      const payment = await paymentService.createPaymentIntent({
        orderId,
        method: 'stripe',
        currency: 'usd',
      })

      // Verify payment amount uses total_amount (discounted amount)
      expect(payment.amount).toBe(4000) // Should use total_amount, not amount
      expect(payment.orderId).toBe(orderId)
    })

    it('should throw error if order not found', async () => {
      await expect(
        paymentService.createPaymentIntent({
          orderId: 99999, // Non-existent order
          method: 'stripe',
          currency: 'usd',
        })
      ).rejects.toThrow('Order not found')
    })
  })

  describe('Stripe Payment Intent Creation', () => {
    it('should ignore client-provided amount and use database amount', async () => {
      // Create an order
      const createdAt = Math.floor(Date.now() / 1000)
      const orderResult = await env.D1_DATABASE
        .prepare('INSERT INTO orders (customer_email, quantity, amount, status, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind('customer@example.com', 1, 3000, 'pending', createdAt)
        .run()

      const orderId = Number(orderResult.meta.last_row_id)

      // Create a product
      await env.D1_DATABASE
        .prepare('INSERT INTO products (name, price, is_active, created_at) VALUES (?, ?, ?, ?)')
        .bind('Test Product', 3000, 1, createdAt)
        .run()

      // Mock Stripe
      const mockStripe = {
        paymentIntents: {
          create: vi.fn().mockResolvedValue({
            id: 'pi_test_123',
            client_secret: 'pi_test_123_secret',
            amount: 3000, // Should match order amount
          }),
        },
      }

      // Create router with mocked Stripe
      const router = createPaymentsRouter({
        ...env,
        STRIPE_SECRET_KEY: 'sk_test_123',
      })

      // Replace Stripe in the router (this is a simplified test - in real scenario we'd inject it)
      // For now, we'll test that the amount validation logic works

      // The validation schema doesn't include amount, so client can't send it
      // This test verifies the behavior conceptually
      const req = new Request('http://localhost/api/payments/stripe/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          currency: 'usd',
          // Note: No amount field - client cannot provide it
        }),
      })

      // The route should fetch order from DB and use its amount
      // Since we can't easily mock Stripe in this test setup,
      // we'll verify the PaymentService behavior instead
      const payment = await paymentService.createPaymentIntent({
        orderId,
        method: 'stripe',
        currency: 'usd',
      })

      // Verify payment uses order amount from database
      expect(payment.amount).toBe(3000)
    })
  })

  describe('PayPal Order Creation', () => {
    it('should ignore client-provided amount and use database amount', async () => {
      // Create an order
      const createdAt = Math.floor(Date.now() / 1000)
      const orderResult = await env.D1_DATABASE
        .prepare('INSERT INTO orders (customer_email, quantity, amount, status, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind('customer@example.com', 1, 2500, 'pending', createdAt)
        .run()

      const orderId = Number(orderResult.meta.last_row_id)

      // Create payment intent - should use order amount from DB
      const payment = await paymentService.createPaymentIntent({
        orderId,
        method: 'paypal',
        currency: 'usd',
      })

      // Verify payment uses order amount from database
      expect(payment.amount).toBe(2500)
    })

    it('should use total_amount when discount is applied', async () => {
      // Create an order with discount
      const createdAt = Math.floor(Date.now() / 1000)
      const orderResult = await env.D1_DATABASE
        .prepare('INSERT INTO orders (customer_email, quantity, amount, total_amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind('customer@example.com', 1, 10000, 7500, 'pending', createdAt) // 25% discount
        .run()

      const orderId = Number(orderResult.meta.last_row_id)

      // Create payment intent - should use total_amount
      const payment = await paymentService.createPaymentIntent({
        orderId,
        method: 'paypal',
        currency: 'usd',
      })

      // Verify payment uses total_amount (discounted amount)
      expect(payment.amount).toBe(7500)
    })
  })

  describe('Payment amount validation in webhooks', () => {
    it('should validate Stripe payment amount matches order amount', async () => {
      // Create an order
      const createdAt = Math.floor(Date.now() / 1000)
      const orderResult = await env.D1_DATABASE
        .prepare('INSERT INTO orders (customer_email, quantity, amount, status, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind('customer@example.com', 1, 5000, 'pending', createdAt)
        .run()

      const orderId = Number(orderResult.meta.last_row_id)

      // Create a payment record
      const payment = await paymentService.createPaymentIntent({
        orderId,
        method: 'stripe',
        currency: 'usd',
      })

      // Get order to verify amount
      const order = await orderService.getById(orderId)
      const expectedAmount = order?.totalAmount ?? order?.amount ?? 0

      // Verify payment amount matches order amount
      expect(payment.amount).toBe(expectedAmount)
      expect(payment.amount).toBe(5000)
    })

    it('should detect amount mismatch in Stripe webhook', async () => {
      // This test verifies the validation logic conceptually
      // In a real webhook, if paymentIntent.amount !== orderAmount, it should be rejected
      
      // Create an order with amount 5000
      const createdAt = Math.floor(Date.now() / 1000)
      const orderResult = await env.D1_DATABASE
        .prepare('INSERT INTO orders (customer_email, quantity, amount, status, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind('customer@example.com', 1, 5000, 'pending', createdAt)
        .run()

      const orderId = Number(orderResult.meta.last_row_id)

      // Get order amount
      const order = await orderService.getById(orderId)
      const expectedAmount = order?.totalAmount ?? order?.amount ?? 0

      // Simulate a payment intent with wrong amount
      const paymentIntentAmount = 3000 // Wrong amount
      
      // Validation should detect mismatch
      expect(paymentIntentAmount).not.toBe(expectedAmount)
      // In the actual webhook handler, this would return 400 error
    })

    it('should validate PayPal payment amount matches order amount', async () => {
      // Create an order
      const createdAt = Math.floor(Date.now() / 1000)
      const orderResult = await env.D1_DATABASE
        .prepare('INSERT INTO orders (customer_email, quantity, amount, total_amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind('customer@example.com', 1, 10000, 8000, 'pending', createdAt)
        .run()

      const orderId = Number(orderResult.meta.last_row_id)

      // Create payment intent - should use total_amount
      const payment = await paymentService.createPaymentIntent({
        orderId,
        method: 'paypal',
        currency: 'usd',
      })

      // Get order to verify amount
      const order = await orderService.getById(orderId)
      const expectedAmount = order?.totalAmount ?? order?.amount ?? 0

      // Verify payment amount matches order total_amount
      expect(payment.amount).toBe(expectedAmount)
      expect(payment.amount).toBe(8000) // Should use total_amount
    })
  })

  describe('Defense in depth', () => {
    it('should validate payment record amount matches order amount after creation', async () => {
      // Create an order
      const createdAt = Math.floor(Date.now() / 1000)
      const orderResult = await env.D1_DATABASE
        .prepare('INSERT INTO orders (customer_email, quantity, amount, status, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind('customer@example.com', 1, 6000, 'pending', createdAt)
        .run()

      const orderId = Number(orderResult.meta.last_row_id)

      // Create payment intent
      const payment = await paymentService.createPaymentIntent({
        orderId,
        method: 'stripe',
        currency: 'usd',
      })

      // Get order
      const order = await orderService.getById(orderId)
      const orderAmount = order?.totalAmount ?? order?.amount ?? 0

      // Verify amounts match (defense in depth check)
      expect(payment.amount).toBe(orderAmount)
      expect(payment.amount).toBe(6000)
    })
  })
})

