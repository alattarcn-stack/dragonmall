import { describe, it, expect, beforeEach } from 'vitest'
import type { Env } from '../types'
import { createOrdersRouter } from '../routes/orders'
import { createTestEnv, createTestAdmin, createTestCustomer } from './utils/test-helpers'
import { signJWT } from '../utils/jwt'
import { OrderService, ProductService } from '@dragon/core'
import { Hono } from 'hono'

describe('POST /api/orders/:id/pay Security', () => {
  let env: Env
  let router: ReturnType<typeof createOrdersRouter>
  let app: Hono<{ Bindings: Env }>

  beforeEach(async () => {
    env = createTestEnv()
    router = createOrdersRouter(env)
    
    // Create a test app with optionalAuth middleware simulation
    app = new Hono<{ Bindings: Env }>()
    app.use('*', async (c, next) => {
      // Simulate optionalAuth middleware - will be set per test
      await next()
    })
    app.route('/api/orders', router)

    // Set up database schema
    await env.D1_DATABASE.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        username TEXT,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        last_login_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price INTEGER NOT NULL,
        stock INTEGER,
        category_id INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        min_quantity INTEGER NOT NULL DEFAULT 1,
        max_quantity INTEGER,
        product_type TEXT NOT NULL DEFAULT 'digital',
        sort_order INTEGER NOT NULL DEFAULT 10,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        customer_email TEXT NOT NULL,
        customer_data TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        amount INTEGER NOT NULL,
        coupon_code TEXT,
        discount_amount INTEGER NOT NULL DEFAULT 0,
        subtotal_amount INTEGER,
        total_amount INTEGER,
        status TEXT NOT NULL CHECK(status IN ('cart', 'pending', 'processing', 'completed', 'cancelled', 'refunded')),
        fulfillment_result TEXT,
        created_at INTEGER NOT NULL,
        completed_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        price INTEGER NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
    `)

    // Create a test product
    await env.D1_DATABASE.exec(`
      INSERT INTO products (name, price, category_id, is_active, min_quantity, product_type, sort_order, created_at)
      VALUES ('Test Product', 10000, 1, 1, 1, 'digital', 10, ${Math.floor(Date.now() / 1000)})
    `)
  })

  describe('Unauthenticated requests', () => {
    it('should return 401 for anonymous requests', async () => {
      // Create a pending order
      const orderService = new OrderService(env.D1_DATABASE)
      const order = await orderService.createDraftOrder({
        productId: 1,
        customerEmail: 'test@example.com',
        quantity: 1,
      })

      // Create app without auth middleware
      const testApp = new Hono<{ Bindings: Env }>()
      testApp.route('/api/orders', router)

      const req = new Request(`http://localhost/api/orders/${order.id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      })

      const res = await testApp.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('Authorization checks', () => {
    it('should return 403 when customer tries to mark another customer\'s order as paid', async () => {
      // Create two customers
      const customer1 = await createTestCustomer(env, 'customer1@example.com', 'Password123!')
      const customer2 = await createTestCustomer(env, 'customer2@example.com', 'Password123!')

      // Create order for customer1
      const orderService = new OrderService(env.D1_DATABASE)
      const order = await orderService.createDraftOrder({
        productId: 1,
        customerEmail: customer1.email,
        quantity: 1,
        userId: customer1.id,
      })

      // Create customer2 token (trying to mark customer1's order as paid)
      const customer2Token = await signJWT(
        { sub: customer2.id, role: 'customer' },
        env.JWT_SECRET!,
        3600
      )

      // Create app with auth middleware
      const testApp = new Hono<{ Bindings: Env }>()
      testApp.use('*', async (c, next) => {
        // Simulate optionalAuth middleware setting customer2 context
        c.set('userId', customer2.id)
        c.set('isAdmin', false)
        c.set('role', 'customer')
        await next()
      })
      testApp.route('/api/orders', router)

      const req = new Request(`http://localhost/api/orders/${order.id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': `customer_token=${customer2Token}`,
        },
      })

      const res = await testApp.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.error).toBe('Forbidden')
    })

    it('should allow admin to mark any order as paid', async () => {
      // Create customer and order
      const customer = await createTestCustomer(env, 'customer@example.com', 'Password123!')
      const orderService = new OrderService(env.D1_DATABASE)
      const order = await orderService.createDraftOrder({
        productId: 1,
        customerEmail: customer.email,
        quantity: 1,
        userId: customer.id,
      })

      // Create admin
      const admin = await createTestAdmin(env, 'admin@example.com', 'Admin123!')
      const adminToken = await signJWT(
        { sub: admin.id, role: 'admin' },
        env.JWT_SECRET!,
        3600
      )

      // Create app with auth middleware
      const testApp = new Hono<{ Bindings: Env }>()
      testApp.use('*', async (c, next) => {
        // Simulate optionalAuth middleware setting admin context
        c.set('userId', admin.id)
        c.set('isAdmin', true)
        c.set('role', 'admin')
        await next()
      })
      testApp.route('/api/orders', router)

      const req = new Request(`http://localhost/api/orders/${order.id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': `admin_token=${adminToken}`,
        },
      })

      const res = await testApp.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.data).toBeDefined()
      expect(data.data.status).toBe('processing') // markPaid sets status to processing
    })

    it('should allow order owner to mark their own order as paid', async () => {
      // Create customer and order
      const customer = await createTestCustomer(env, 'customer@example.com', 'Password123!')
      const orderService = new OrderService(env.D1_DATABASE)
      const order = await orderService.createDraftOrder({
        productId: 1,
        customerEmail: customer.email,
        quantity: 1,
        userId: customer.id,
      })

      // Create customer token
      const customerToken = await signJWT(
        { sub: customer.id, role: 'customer' },
        env.JWT_SECRET!,
        3600
      )

      // Create app with auth middleware
      const testApp = new Hono<{ Bindings: Env }>()
      testApp.use('*', async (c, next) => {
        // Simulate optionalAuth middleware setting customer context
        c.set('userId', customer.id)
        c.set('isAdmin', false)
        c.set('role', 'customer')
        await next()
      })
      testApp.route('/api/orders', router)

      const req = new Request(`http://localhost/api/orders/${order.id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': `customer_token=${customerToken}`,
        },
      })

      const res = await testApp.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.data).toBeDefined()
      expect(data.data.status).toBe('processing')
    })
  })

  describe('Order status validation', () => {
    it('should return 400 when trying to mark non-pending order as paid', async () => {
      // Create customer and order
      const customer = await createTestCustomer(env, 'customer@example.com', 'Password123!')
      const orderService = new OrderService(env.D1_DATABASE)
      const order = await orderService.createDraftOrder({
        productId: 1,
        customerEmail: customer.email,
        quantity: 1,
        userId: customer.id,
      })

      // Mark order as completed first
      await orderService.updateStatus(order.id, 'completed')

      // Create customer token
      const customerToken = await signJWT(
        { sub: customer.id, role: 'customer' },
        env.JWT_SECRET!,
        3600
      )

      // Create app with auth middleware
      const testApp = new Hono<{ Bindings: Env }>()
      testApp.use('*', async (c, next) => {
        c.set('userId', customer.id)
        c.set('isAdmin', false)
        c.set('role', 'customer')
        await next()
      })
      testApp.route('/api/orders', router)

      const req = new Request(`http://localhost/api/orders/${order.id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': `customer_token=${customerToken}`,
        },
      })

      const res = await testApp.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('Invalid order status')
      expect(data.message).toContain('Only pending orders can be marked as paid')
    })

    it('should allow marking pending order as paid', async () => {
      // Create customer and order
      const customer = await createTestCustomer(env, 'customer@example.com', 'Password123!')
      const orderService = new OrderService(env.D1_DATABASE)
      const order = await orderService.createDraftOrder({
        productId: 1,
        customerEmail: customer.email,
        quantity: 1,
        userId: customer.id,
      })

      // Verify order is pending
      expect(order.status).toBe('pending')

      // Create customer token
      const customerToken = await signJWT(
        { sub: customer.id, role: 'customer' },
        env.JWT_SECRET!,
        3600
      )

      // Create app with auth middleware
      const testApp = new Hono<{ Bindings: Env }>()
      testApp.use('*', async (c, next) => {
        c.set('userId', customer.id)
        c.set('isAdmin', false)
        c.set('role', 'customer')
        await next()
      })
      testApp.route('/api/orders', router)

      const req = new Request(`http://localhost/api/orders/${order.id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': `customer_token=${customerToken}`,
        },
      })

      const res = await testApp.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.data.status).toBe('processing')
    })
  })

  describe('Order not found', () => {
    it('should return 404 for non-existent order', async () => {
      // Create admin
      const admin = await createTestAdmin(env, 'admin@example.com', 'Admin123!')
      const adminToken = await signJWT(
        { sub: admin.id, role: 'admin' },
        env.JWT_SECRET!,
        3600
      )

      // Create app with auth middleware
      const testApp = new Hono<{ Bindings: Env }>()
      testApp.use('*', async (c, next) => {
        c.set('userId', admin.id)
        c.set('isAdmin', true)
        c.set('role', 'admin')
        await next()
      })
      testApp.route('/api/orders', router)

      const req = new Request('http://localhost/api/orders/99999/pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': `admin_token=${adminToken}`,
        },
      })

      const res = await testApp.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(404)
      expect(data.error).toBe('Order not found')
    })
  })
})

