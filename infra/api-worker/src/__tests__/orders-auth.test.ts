import { describe, it, expect, beforeEach } from 'vitest'
import type { Env } from '../types'
import { createTestEnv, createTestAdmin, createTestCustomer } from './utils/test-helpers'
import { signJWT } from '../utils/jwt'
import { OrderService } from '@dragon/core'
import app from '../index'

describe('Order Authorization - GET /api/orders/:id', () => {
  let env: Env

  beforeEach(async () => {
    env = createTestEnv()
    
    // Add APP to env for testing (matching other test patterns)
    ;(env as any).APP = {
      fetch: (request: Request, env: Env, ctx?: ExecutionContext) => {
        return app.fetch(request, env, ctx)
      }
    }

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

  describe('Admin access', () => {
    it('should allow admin to access any order', async () => {
      // Create admin user
      const admin = await createTestAdmin(env, 'admin@example.com', 'Admin123!')
      
      // Create a customer user
      const customer = await createTestCustomer(env, 'customer@example.com', 'Customer123!')
      
      // Create an order for the customer
      const orderService = new OrderService(env.D1_DATABASE)
      const order = await orderService.createDraftOrder({
        productId: 1,
        customerEmail: customer.email,
        quantity: 1,
        userId: customer.id,
      })

      // Create admin JWT token
      const adminToken = await signJWT(
        { sub: admin.id, role: 'admin' },
        env.JWT_SECRET!,
        3600
      )

      // Make request with admin token
      const response = await (env as any).APP.fetch(`http://localhost/api/orders/${order.id}`, {
        method: 'GET',
        headers: {
          'Cookie': `admin_token=${adminToken}`,
        },
      })

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toBeDefined()
      expect(data.data.id).toBe(order.id)
      expect(data.data.items).toBeDefined()
    })
  })

  describe('Customer access', () => {
    it('should allow customer to access their own order', async () => {
      // Create customer user
      const customer = await createTestCustomer(env, 'customer@example.com', 'Customer123!')
      
      // Create an order for the customer
      const orderService = new OrderService(env.D1_DATABASE)
      const order = await orderService.createDraftOrder({
        productId: 1,
        customerEmail: customer.email,
        quantity: 1,
        userId: customer.id,
      })

      // Create customer JWT token
      const customerToken = await signJWT(
        { sub: customer.id, role: 'customer' },
        env.JWT_SECRET!,
        3600
      )

      // Make request with customer token
      const response = await (env as any).APP.fetch(`http://localhost/api/orders/${order.id}`, {
        method: 'GET',
        headers: {
          'Cookie': `customer_token=${customerToken}`,
        },
      })

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toBeDefined()
      expect(data.data.id).toBe(order.id)
      expect(data.data.items).toBeDefined()
    })

    it('should block customer from accessing another customer\'s order (403)', async () => {
      // Create two customer users
      const customer1 = await createTestCustomer(env, 'customer1@example.com', 'Customer123!')
      const customer2 = await createTestCustomer(env, 'customer2@example.com', 'Customer123!')
      
      // Create an order for customer1
      const orderService = new OrderService(env.D1_DATABASE)
      const order = await orderService.createDraftOrder({
        productId: 1,
        customerEmail: customer1.email,
        quantity: 1,
        userId: customer1.id,
      })

      // Create customer2 JWT token (trying to access customer1's order)
      const customer2Token = await signJWT(
        { sub: customer2.id, role: 'customer' },
        env.JWT_SECRET!,
        3600
      )

      // Make request with customer2 token trying to access customer1's order
      const response = await (env as any).APP.fetch(`http://localhost/api/orders/${order.id}`, {
        method: 'GET',
        headers: {
          'Cookie': `customer_token=${customer2Token}`,
        },
      })

      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Forbidden')
    })
  })

  describe('Unauthenticated access', () => {
    it('should block unauthenticated users (401)', async () => {
      // Create an order
      const orderService = new OrderService(env.D1_DATABASE)
      const order = await orderService.createDraftOrder({
        productId: 1,
        customerEmail: 'test@example.com',
        quantity: 1,
      })

      // Make request without authentication
      const response = await (env as any).APP.fetch(`http://localhost/api/orders/${order.id}`, {
        method: 'GET',
      })

      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('Order not found', () => {
    it('should return 404 for non-existent order', async () => {
      // Create admin user
      const admin = await createTestAdmin(env, 'admin@example.com', 'Admin123!')

      // Create admin JWT token
      const adminToken = await signJWT(
        { sub: admin.id, role: 'admin' },
        env.JWT_SECRET!,
        3600
      )

      // Make request for non-existent order
      const response = await (env as any).APP.fetch('http://localhost/api/orders/99999', {
        method: 'GET',
        headers: {
          'Cookie': `admin_token=${adminToken}`,
        },
      })

      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Order not found')
    })
  })
})
