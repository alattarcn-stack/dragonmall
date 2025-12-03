import { describe, it, expect, beforeEach } from 'vitest'
import { createTestEnv, createTestCustomer } from './utils/test-helpers'
import { CouponService, OrderService, ProductService } from '@dragon/core'

describe('Cart Coupon API', () => {
  let env: ReturnType<typeof createTestEnv>
  let customerToken: string
  let userId: number

  beforeEach(async () => {
    env = createTestEnv()
    const customer = await createTestCustomer(env)
    customerToken = customer.token
    userId = customer.userId

    // Create tables
    await env.D1_DATABASE.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        category_id INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        min_quantity INTEGER NOT NULL DEFAULT 1,
        product_type TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 10,
        created_at INTEGER NOT NULL
      )
    `)

    await env.D1_DATABASE.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        customer_email TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        amount INTEGER NOT NULL,
        coupon_code TEXT,
        discount_amount INTEGER NOT NULL DEFAULT 0,
        subtotal_amount INTEGER,
        total_amount INTEGER,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `)

    await env.D1_DATABASE.exec(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        price INTEGER NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `)

    await env.D1_DATABASE.exec(`
      CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL CHECK(type IN ('percentage', 'fixed')),
        amount INTEGER NOT NULL,
        currency TEXT,
        max_uses INTEGER,
        used_count INTEGER NOT NULL DEFAULT 0,
        per_user_limit INTEGER,
        min_order_amount INTEGER,
        starts_at INTEGER,
        ends_at INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // Create a test product
    const now = Math.floor(Date.now() / 1000)
    await env.D1_DATABASE.exec(`
      INSERT INTO products (name, price, category_id, is_active, min_quantity, product_type, sort_order, created_at)
      VALUES ('Test Product', 10000, 0, 1, 1, 'digital', 10, ${now})
    `)
  })

  describe('POST /api/cart/apply-coupon', () => {
    it('should apply valid coupon to cart', async () => {
      // Create a coupon
      const couponService = new CouponService(env.D1_DATABASE)
      const now = Math.floor(Date.now() / 1000)
      await couponService.createCoupon({
        code: 'SAVE10',
        type: 'percentage',
        amount: 10,
        isActive: true,
      })

      // Create a cart with items
      const orderService = new OrderService(env.D1_DATABASE)
      const order = await orderService.create({
        userId,
        customerEmail: 'test@example.com',
        quantity: 1,
        amount: 10000,
        status: 'cart',
      })

      await env.D1_DATABASE.exec(`
        INSERT INTO order_items (order_id, product_id, quantity, price)
        VALUES (${order.id}, 1, 1, 10000)
      `)

      // Apply coupon
      const response = await env.APP.fetch('http://localhost/api/cart/apply-coupon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': `customer_token=${customerToken}`,
        },
        body: JSON.stringify({ code: 'SAVE10' }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data).toBeDefined()
      expect(data.data.couponCode).toBe('SAVE10')
      expect(data.data.discountAmount).toBe(1000) // 10% of $100
      expect(data.data.totalAmount).toBe(9000) // $90
    })

    it('should reject invalid coupon code', async () => {
      const response = await env.APP.fetch('http://localhost/api/cart/apply-coupon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': `customer_token=${customerToken}`,
        },
        body: JSON.stringify({ code: 'INVALID' }),
      })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Invalid coupon code')
    })

    it('should reject expired coupon', async () => {
      const couponService = new CouponService(env.D1_DATABASE)
      const now = Math.floor(Date.now() / 1000)
      await couponService.createCoupon({
        code: 'EXPIRED',
        type: 'percentage',
        amount: 10,
        isActive: true,
        endsAt: now - 86400, // Expired yesterday
      })

      const orderService = new OrderService(env.D1_DATABASE)
      const order = await orderService.create({
        userId,
        customerEmail: 'test@example.com',
        quantity: 1,
        amount: 10000,
        status: 'cart',
      })

      await env.D1_DATABASE.exec(`
        INSERT INTO order_items (order_id, product_id, quantity, price)
        VALUES (${order.id}, 1, 1, 10000)
      `)

      const response = await env.APP.fetch('http://localhost/api/cart/apply-coupon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': `customer_token=${customerToken}`,
        },
        body: JSON.stringify({ code: 'EXPIRED' }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('expired')
    })

    it('should reject if minimum order amount not met', async () => {
      const couponService = new CouponService(env.D1_DATABASE)
      await couponService.createCoupon({
        code: 'MIN50',
        type: 'percentage',
        amount: 10,
        isActive: true,
        minOrderAmount: 5000, // $50 minimum
      })

      const orderService = new OrderService(env.D1_DATABASE)
      const order = await orderService.create({
        userId,
        customerEmail: 'test@example.com',
        quantity: 1,
        amount: 3000, // $30 - below minimum
        status: 'cart',
      })

      await env.D1_DATABASE.exec(`
        INSERT INTO order_items (order_id, product_id, quantity, price)
        VALUES (${order.id}, 1, 1, 3000)
      `)

      const response = await env.APP.fetch('http://localhost/api/cart/apply-coupon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': `customer_token=${customerToken}`,
        },
        body: JSON.stringify({ code: 'MIN50' }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Minimum order amount')
    })
  })

  describe('DELETE /api/cart/remove-coupon', () => {
    it('should remove coupon from cart', async () => {
      // Create cart with coupon applied
      const orderService = new OrderService(env.D1_DATABASE)
      const order = await orderService.create({
        userId,
        customerEmail: 'test@example.com',
        quantity: 1,
        amount: 9000, // After discount
        status: 'cart',
      })

      await env.D1_DATABASE.exec(`
        INSERT INTO order_items (order_id, product_id, quantity, price)
        VALUES (${order.id}, 1, 1, 10000)
      `)

      await env.D1_DATABASE.exec(`
        UPDATE orders SET coupon_code = 'SAVE10', discount_amount = 1000, subtotal_amount = 10000, total_amount = 9000
        WHERE id = ${order.id}
      `)

      // Remove coupon
      const response = await env.APP.fetch('http://localhost/api/cart/remove-coupon', {
        method: 'DELETE',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': `customer_token=${customerToken}`,
        },
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data.couponCode).toBeNull()
      expect(data.data.discountAmount).toBe(0)
      expect(data.data.totalAmount).toBe(10000) // Back to original
    })
  })
})

