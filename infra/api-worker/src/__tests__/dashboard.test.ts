import { describe, it, expect, beforeEach } from 'vitest'
import { createTestEnv, createTestAdmin } from './utils/test-helpers'

describe('Admin Dashboard API', () => {
  let env: ReturnType<typeof createTestEnv>
  let adminToken: string

  beforeEach(async () => {
    env = createTestEnv()
    const admin = await createTestAdmin(env)
    adminToken = admin.token

    // Create tables
    await env.D1_DATABASE.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      )
    `)

    await env.D1_DATABASE.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        product_type TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
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
        price INTEGER NOT NULL
      )
    `)

    await env.D1_DATABASE.exec(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_number TEXT UNIQUE NOT NULL,
        order_id INTEGER,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'usd',
        method TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        paid_at INTEGER
      )
    `)
  })

  it('should return dashboard stats with correct aggregates', async () => {
    const now = Math.floor(Date.now() / 1000)
    const twentyDaysAgo = now - 20 * 24 * 60 * 60
    const tenDaysAgo = now - 10 * 24 * 60 * 60

    // Create customers
    await env.D1_DATABASE.exec(`
      INSERT INTO users (email, password_hash, role, is_active, created_at)
      VALUES 
        ('customer1@example.com', 'hash1', 'customer', 1, ${now}),
        ('customer2@example.com', 'hash2', 'customer', 1, ${now}),
        ('customer3@example.com', 'hash3', 'customer', 0, ${now})
    `)

    // Create products
    await env.D1_DATABASE.exec(`
      INSERT INTO products (name, price, product_type, is_active, created_at)
      VALUES 
        ('Product A', 10000, 'digital', 1, ${now}),
        ('Product B', 20000, 'digital', 1, ${now})
    `)

    // Create orders and payments (some within last 30 days, some older)
    await env.D1_DATABASE.exec(`
      INSERT INTO orders (customer_email, quantity, amount, status, created_at)
      VALUES 
        ('customer1@example.com', 1, 10000, 'completed', ${twentyDaysAgo}),
        ('customer2@example.com', 2, 20000, 'completed', ${tenDaysAgo}),
        ('customer1@example.com', 1, 10000, 'cancelled', ${twentyDaysAgo}),
        ('customer2@example.com', 1, 10000, 'completed', ${now - 40 * 24 * 60 * 60})
    `)

    await env.D1_DATABASE.exec(`
      INSERT INTO order_items (order_id, product_id, quantity, price)
      VALUES 
        (1, 1, 1, 10000),
        (2, 2, 2, 20000),
        (3, 1, 1, 10000),
        (4, 1, 1, 10000)
    `)

    await env.D1_DATABASE.exec(`
      INSERT INTO payments (transaction_number, order_id, amount, currency, method, status, created_at, paid_at)
      VALUES 
        ('TXN-1', 1, 10000, 'usd', 'stripe', 'paid', ${twentyDaysAgo}, ${twentyDaysAgo}),
        ('TXN-2', 2, 20000, 'usd', 'stripe', 'paid', ${tenDaysAgo}, ${tenDaysAgo}),
        ('TXN-3', 3, 10000, 'usd', 'stripe', 'paid', ${twentyDaysAgo}, ${twentyDaysAgo}),
        ('TXN-4', 4, 10000, 'usd', 'stripe', 'paid', ${now - 40 * 24 * 60 * 60}, ${now - 40 * 24 * 60 * 60})
    `)

    const response = await env.APP.fetch('http://localhost/api/admin/dashboard', {
      method: 'GET',
      headers: {
        'Cookie': `admin_token=${adminToken}`,
      },
    })

    expect(response.status).toBe(200)
    const result = await response.json()

    expect(result.data).toBeDefined()
    expect(result.data.totalRevenueLast30Days).toBe(30000) // Orders 1 and 2 (order 3 is cancelled, order 4 is too old)
    expect(result.data.ordersLast30Days).toBe(2) // Orders 1 and 2
    expect(result.data.totalCustomers).toBe(2) // Only active customers
    expect(result.data.revenueByDay).toHaveLength(30)
    expect(result.data.topProducts).toBeDefined()
    expect(Array.isArray(result.data.topProducts)).toBe(true)
  })

  it('should exclude cancelled and refunded orders from revenue', async () => {
    const now = Math.floor(Date.now() / 1000)
    const tenDaysAgo = now - 10 * 24 * 60 * 60

    await env.D1_DATABASE.exec(`
      INSERT INTO orders (customer_email, quantity, amount, status, created_at)
      VALUES 
        ('test@example.com', 1, 10000, 'completed', ${tenDaysAgo}),
        ('test@example.com', 1, 20000, 'refunded', ${tenDaysAgo}),
        ('test@example.com', 1, 15000, 'cancelled', ${tenDaysAgo})
    `)

    await env.D1_DATABASE.exec(`
      INSERT INTO payments (transaction_number, order_id, amount, currency, method, status, created_at, paid_at)
      VALUES 
        ('TXN-1', 1, 10000, 'usd', 'stripe', 'paid', ${tenDaysAgo}, ${tenDaysAgo}),
        ('TXN-2', 2, 20000, 'usd', 'stripe', 'paid', ${tenDaysAgo}, ${tenDaysAgo}),
        ('TXN-3', 3, 15000, 'usd', 'stripe', 'paid', ${tenDaysAgo}, ${tenDaysAgo})
    `)

    const response = await env.APP.fetch('http://localhost/api/admin/dashboard', {
      method: 'GET',
      headers: {
        'Cookie': `admin_token=${adminToken}`,
      },
    })

    expect(response.status).toBe(200)
    const result = await response.json()

    // Only order 1 should count (completed, not refunded/cancelled)
    expect(result.data.totalRevenueLast30Days).toBe(10000)
    expect(result.data.ordersLast30Days).toBe(1)
  })

  it('should return top products sorted by revenue', async () => {
    const now = Math.floor(Date.now() / 1000)
    const tenDaysAgo = now - 10 * 24 * 60 * 60

    await env.D1_DATABASE.exec(`
      INSERT INTO products (name, price, product_type, is_active, created_at)
      VALUES 
        ('Product A', 10000, 'digital', 1, ${now}),
        ('Product B', 20000, 'digital', 1, ${now}),
        ('Product C', 5000, 'digital', 1, ${now})
    `)

    await env.D1_DATABASE.exec(`
      INSERT INTO orders (customer_email, quantity, amount, status, created_at)
      VALUES 
        ('test@example.com', 1, 10000, 'completed', ${tenDaysAgo}),
        ('test@example.com', 1, 20000, 'completed', ${tenDaysAgo}),
        ('test@example.com', 2, 10000, 'completed', ${tenDaysAgo})
    `)

    await env.D1_DATABASE.exec(`
      INSERT INTO order_items (order_id, product_id, quantity, price)
      VALUES 
        (1, 1, 1, 10000),
        (2, 2, 1, 20000),
        (3, 3, 2, 5000)
    `)

    await env.D1_DATABASE.exec(`
      INSERT INTO payments (transaction_number, order_id, amount, currency, method, status, created_at, paid_at)
      VALUES 
        ('TXN-1', 1, 10000, 'usd', 'stripe', 'paid', ${tenDaysAgo}, ${tenDaysAgo}),
        ('TXN-2', 2, 20000, 'usd', 'stripe', 'paid', ${tenDaysAgo}, ${tenDaysAgo}),
        ('TXN-3', 3, 10000, 'usd', 'stripe', 'paid', ${tenDaysAgo}, ${tenDaysAgo})
    `)

    const response = await env.APP.fetch('http://localhost/api/admin/dashboard', {
      method: 'GET',
      headers: {
        'Cookie': `admin_token=${adminToken}`,
      },
    })

    expect(response.status).toBe(200)
    const result = await response.json()

    expect(result.data.topProducts.length).toBeGreaterThan(0)
    // Product B should be first (highest revenue: 20000)
    expect(result.data.topProducts[0].name).toBe('Product B')
    expect(result.data.topProducts[0].totalRevenue).toBe(20000)
  })
})

