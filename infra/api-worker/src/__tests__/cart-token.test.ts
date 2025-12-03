import { describe, it, expect, beforeEach } from 'vitest'
import type { Env } from '../types'
import { generateCartToken, verifyCartToken, getOrCreateCart } from '../utils/cart'
import { createTestEnv } from './utils/test-helpers'
import { signJWT, getJWTSecret } from '../utils/jwt'

describe('Cart Token Verification', () => {
  let env: Env

  beforeEach(async () => {
    env = createTestEnv()

    // Create orders table for cart storage
    await env.D1_DATABASE.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        customer_email TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        amount INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `)
  })

  describe('generateCartToken', () => {
    it('should generate a token with 30 days expiration', async () => {
      const cartId = 123
      const token = await generateCartToken(cartId, env)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)
    })
  })

  describe('verifyCartToken', () => {
    it('should return cart ID for valid token with existing cart', async () => {
      // Create a cart in database
      const createdAt = Math.floor(Date.now() / 1000)
      const result = await env.D1_DATABASE
        .prepare('INSERT INTO orders (user_id, customer_email, quantity, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(null, 'guest@example.com', 0, 0, 'cart', createdAt)
        .run()

      const cartId = Number(result.meta.last_row_id)

      // Generate token
      const token = await generateCartToken(cartId, env)

      // Verify token
      const verifiedCartId = await verifyCartToken(token, env)

      expect(verifiedCartId).toBe(cartId)
    })

    it('should return null for expired token', async () => {
      const cartId = 456
      
      // Create a cart
      const createdAt = Math.floor(Date.now() / 1000)
      await env.D1_DATABASE
        .prepare('INSERT INTO orders (user_id, customer_email, quantity, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(null, 'guest@example.com', 0, 0, 'cart', createdAt)
        .run()

      // Create an expired token manually (expired 1 hour ago)
      const secret = getJWTSecret(env)
      const expiredToken = await signJWT(
        { sub: cartId, role: 'customer' },
        secret,
        -3600 // Negative expiration = already expired
      )

      // Verify expired token
      const verifiedCartId = await verifyCartToken(expiredToken, env)

      expect(verifiedCartId).toBeNull()
    })

    it('should return null for token with non-existent cart', async () => {
      const nonExistentCartId = 999

      // Generate token for cart that doesn't exist
      const token = await generateCartToken(nonExistentCartId, env)

      // Verify token - should return null because cart doesn't exist
      const verifiedCartId = await verifyCartToken(token, env)

      expect(verifiedCartId).toBeNull()
    })

    it('should return null for invalid token', async () => {
      const invalidToken = 'invalid.token.here'

      const verifiedCartId = await verifyCartToken(invalidToken, env)

      expect(verifiedCartId).toBeNull()
    })

    it('should return null for token with cart that is not in cart status', async () => {
      // Create a cart and convert it to pending order
      const createdAt = Math.floor(Date.now() / 1000)
      const result = await env.D1_DATABASE
        .prepare('INSERT INTO orders (user_id, customer_email, quantity, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(null, 'guest@example.com', 0, 0, 'cart', createdAt)
        .run()

      const cartId = Number(result.meta.last_row_id)

      // Generate token
      const token = await generateCartToken(cartId, env)

      // Convert cart to pending order
      await env.D1_DATABASE
        .prepare('UPDATE orders SET status = ? WHERE id = ?')
        .bind('pending', cartId)
        .run()

      // Verify token - should return null because cart is no longer in cart status
      const verifiedCartId = await verifyCartToken(token, env)

      expect(verifiedCartId).toBeNull()
    })
  })

  describe('getOrCreateCart', () => {
    it('should return existing cart for valid token with valid cart', async () => {
      // Create a cart
      const createdAt = Math.floor(Date.now() / 1000)
      const result = await env.D1_DATABASE
        .prepare('INSERT INTO orders (user_id, customer_email, quantity, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(null, 'guest@example.com', 0, 0, 'cart', createdAt)
        .run()

      const cartId = Number(result.meta.last_row_id)

      // Generate token
      const token = await generateCartToken(cartId, env)

      // Get or create cart
      const { cartId: resultCartId, isNew } = await getOrCreateCart(null, token, null, env)

      expect(resultCartId).toBe(cartId)
      expect(isNew).toBe(false)
    })

    it('should create new cart for expired token', async () => {
      const originalCartId = 789
      
      // Create original cart
      const createdAt = Math.floor(Date.now() / 1000)
      await env.D1_DATABASE
        .prepare('INSERT INTO orders (user_id, customer_email, quantity, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(null, 'guest@example.com', 0, 0, 'cart', createdAt)
        .run()

      // Create expired token
      const secret = getJWTSecret(env)
      const expiredToken = await signJWT(
        { sub: originalCartId, role: 'customer' },
        secret,
        -3600 // Expired
      )

      // Get or create cart with expired token
      const { cartId: resultCartId, isNew } = await getOrCreateCart(null, expiredToken, null, env)

      // Should create a new cart
      expect(resultCartId).not.toBe(originalCartId)
      expect(isNew).toBe(true)

      // Verify new cart exists
      const newCart = await env.D1_DATABASE
        .prepare('SELECT id FROM orders WHERE id = ? AND status = ?')
        .bind(resultCartId, 'cart')
        .first<{ id: number }>()

      expect(newCart).toBeDefined()
      expect(newCart?.id).toBe(resultCartId)
    })

    it('should create new cart for token with non-existent cart', async () => {
      const nonExistentCartId = 999

      // Generate token for non-existent cart
      const token = await generateCartToken(nonExistentCartId, env)

      // Get or create cart
      const { cartId: resultCartId, isNew } = await getOrCreateCart(null, token, null, env)

      // Should create a new cart
      expect(resultCartId).not.toBe(nonExistentCartId)
      expect(isNew).toBe(true)

      // Verify new cart exists
      const newCart = await env.D1_DATABASE
        .prepare('SELECT id FROM orders WHERE id = ? AND status = ?')
        .bind(resultCartId, 'cart')
        .first<{ id: number }>()

      expect(newCart).toBeDefined()
      expect(newCart?.id).toBe(resultCartId)
    })

    it('should create new cart when no token provided', async () => {
      const { cartId, isNew } = await getOrCreateCart(null, null, null, env)

      expect(cartId).toBeDefined()
      expect(typeof cartId).toBe('number')
      expect(isNew).toBe(true)

      // Verify cart exists
      const cart = await env.D1_DATABASE
        .prepare('SELECT id FROM orders WHERE id = ? AND status = ?')
        .bind(cartId, 'cart')
        .first<{ id: number }>()

      expect(cart).toBeDefined()
      expect(cart?.id).toBe(cartId)
    })

    it('should return existing cart for logged-in user', async () => {
      // Create a user cart
      const createdAt = Math.floor(Date.now() / 1000)
      const result = await env.D1_DATABASE
        .prepare('INSERT INTO orders (user_id, customer_email, quantity, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(123, 'user@example.com', 0, 0, 'cart', createdAt)
        .run()

      const cartId = Number(result.meta.last_row_id)

      // Get or create cart for logged-in user
      const { cartId: resultCartId, isNew } = await getOrCreateCart(123, null, null, env)

      expect(resultCartId).toBe(cartId)
      expect(isNew).toBe(false)
    })
  })

  describe('Token expiration handling', () => {
    it('should handle token that expires exactly at current time', async () => {
      // Create a cart
      const createdAt = Math.floor(Date.now() / 1000)
      const result = await env.D1_DATABASE
        .prepare('INSERT INTO orders (user_id, customer_email, quantity, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(null, 'guest@example.com', 0, 0, 'cart', createdAt)
        .run()

      const cartId = Number(result.meta.last_row_id)

      // Create token that expires in 0 seconds (expires now)
      const secret = getJWTSecret(env)
      const expiringToken = await signJWT(
        { sub: cartId, role: 'customer' },
        secret,
        0 // Expires immediately
      )

      // Small delay to ensure token is expired
      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify token - should return null because it's expired
      const verifiedCartId = await verifyCartToken(expiringToken, env)

      expect(verifiedCartId).toBeNull()
    })
  })
})

