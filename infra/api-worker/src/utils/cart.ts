import type { Env } from '../types'
import { OrderService } from '@dragon/core'
import { signJWT, verifyJWT, getJWTSecret } from './jwt'
import { logError, logInfo } from './logging'

/**
 * Cart ID payload for signed cart tokens
 */
interface CartIdPayload {
  cartId: number
  iat?: number
  exp?: number
}

/**
 * Generate a signed cart ID token for guest users
 */
export async function generateCartToken(cartId: number, env: Env): Promise<string> {
  try {
    const secret = getJWTSecret(env)
    const token = await signJWT(
      { sub: cartId, role: 'customer' }, // Reuse JWT structure
      secret,
      30 * 24 * 60 * 60 // 30 days expiry for cart
    )
    return token
  } catch (error) {
    logError('Failed to generate cart token', error, { cartId }, env)
    throw error
  }
}

/**
 * Verify and extract cart ID from signed token
 * Returns null if token is invalid, expired, or cart doesn't exist
 */
export async function verifyCartToken(token: string, env: Env): Promise<number | null> {
  try {
    const secret = getJWTSecret(env)
    const payload = await verifyJWT(token, secret)
    
    // verifyJWT already checks expiration (exp claim), so if we get here, token is valid
    if (payload && payload.sub) {
      const cartId = Number(payload.sub)
      
      // Verify cart still exists in database (optional but recommended)
      const cart = await env.D1_DATABASE
        .prepare('SELECT id FROM orders WHERE id = ? AND status = ?')
        .bind(cartId, 'cart')
        .first<{ id: number }>()
      
      if (cart) {
        return cartId
      }
      
      // Cart doesn't exist - token is invalid
      return null
    }
    
    return null
  } catch (error) {
    // Token is invalid, expired, or malformed - return null
    // This includes JWT expiration errors from verifyJWT
    return null
  }
}

/**
 * Get or create a cart for the current user/guest
 */
export async function getOrCreateCart(
  userId: number | null,
  cartToken: string | null,
  customerEmail: string | null,
  env: Env
): Promise<{ cartId: number; isNew: boolean }> {
  const orderService = new OrderService(env.D1_DATABASE)

  // For logged-in users, find existing cart by user_id
  if (userId) {
    const existingCart = await env.D1_DATABASE
      .prepare('SELECT id FROM orders WHERE user_id = ? AND status = ? LIMIT 1')
      .bind(userId, 'cart')
      .first<{ id: number }>()

    if (existingCart) {
      return { cartId: existingCart.id, isNew: false }
    }

    // Create new cart for logged-in user
    const createdAt = Math.floor(Date.now() / 1000)
    const result = await env.D1_DATABASE
      .prepare(
        'INSERT INTO orders (user_id, customer_email, quantity, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(userId, customerEmail || 'guest@example.com', 0, 0, 'cart', createdAt)
      .run()

    const cartId = result.meta.last_row_id
    if (!cartId) {
      throw new Error('Failed to create cart')
    }

    return { cartId: Number(cartId), isNew: true }
  }

  // For guest users, verify cart token
  if (cartToken) {
    const cartId = await verifyCartToken(cartToken, env)
    // verifyCartToken already checks expiration and cart existence
    // If it returns a cartId, the token is valid and cart exists
    if (cartId) {
      return { cartId, isNew: false }
    }
    // If token is expired, invalid, or cart doesn't exist, fall through to create new cart
  }

  // Create new cart for guest
  const createdAt = Math.floor(Date.now() / 1000)
  const result = await env.D1_DATABASE
    .prepare(
      'INSERT INTO orders (user_id, customer_email, quantity, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(null, customerEmail || 'guest@example.com', 0, 0, 'cart', createdAt)
    .run()

  const cartId = result.meta.last_row_id
  if (!cartId) {
    throw new Error('Failed to create cart')
  }

  return { cartId: Number(cartId), isNew: true }
}

/**
 * Associate a guest cart with a user account (on login/signup)
 */
export async function associateCartWithUser(
  cartId: number,
  userId: number,
  customerEmail: string,
  env: Env
): Promise<void> {
  // Check if user already has a cart
  const existingCart = await env.D1_DATABASE
    .prepare('SELECT id FROM orders WHERE user_id = ? AND status = ? LIMIT 1')
    .bind(userId, 'cart')
    .first<{ id: number }>()

  if (existingCart) {
    // Merge carts: move items from guest cart to user cart
    const guestItems = await env.D1_DATABASE
      .prepare('SELECT * FROM order_items WHERE order_id = ?')
      .bind(cartId)
      .all<{ id: number; product_id: number; quantity: number; price: number }>()

    for (const item of guestItems.results || []) {
      // Check if item already exists in user cart
      const existingItem = await env.D1_DATABASE
        .prepare('SELECT id, quantity FROM order_items WHERE order_id = ? AND product_id = ?')
        .bind(existingCart.id, item.product_id)
        .first<{ id: number; quantity: number }>()

      if (existingItem) {
        // Update quantity
        await env.D1_DATABASE
          .prepare('UPDATE order_items SET quantity = ? WHERE id = ?')
          .bind(existingItem.quantity + item.quantity, existingItem.id)
          .run()
      } else {
        // Add new item
        await env.D1_DATABASE
          .prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)')
          .bind(existingCart.id, item.product_id, item.quantity, item.price)
          .run()
      }
    }

    // Delete guest cart
    await env.D1_DATABASE
      .prepare('DELETE FROM orders WHERE id = ?')
      .bind(cartId)
      .run()

    // Recalculate user cart total
    await recalculateCartTotal(existingCart.id, env)
  } else {
    // Associate guest cart with user
    await env.D1_DATABASE
      .prepare('UPDATE orders SET user_id = ?, customer_email = ? WHERE id = ?')
      .bind(userId, customerEmail, cartId)
      .run()
  }
}

/**
 * Recalculate cart total based on items
 */
export async function recalculateCartTotal(cartId: number, env: Env): Promise<void> {
  // Get all items and calculate total
  const items = await env.D1_DATABASE
    .prepare('SELECT quantity, price FROM order_items WHERE order_id = ?')
    .bind(cartId)
    .all<{ quantity: number; price: number }>()

  const totalAmount = (items.results || []).reduce(
    (sum, item) => sum + item.quantity * item.price,
    0
  )

  const totalQuantity = (items.results || []).reduce(
    (sum, item) => sum + item.quantity,
    0
  )

  // Update cart
  await env.D1_DATABASE
    .prepare('UPDATE orders SET amount = ?, quantity = ? WHERE id = ?')
    .bind(totalAmount, totalQuantity, cartId)
    .run()
}

/**
 * Get cart with items
 */
export async function getCartWithItems(cartId: number, env: Env) {
  const order = await env.D1_DATABASE
    .prepare('SELECT * FROM orders WHERE id = ? AND status = ?')
    .bind(cartId, 'cart')
    .first<{
      id: number
      user_id: number | null
      customer_email: string
      quantity: number
      amount: number
      coupon_code: string | null
      discount_amount: number
      subtotal_amount: number | null
      total_amount: number | null
      created_at: number
    }>()

  if (!order) {
    return null
  }

  const items = await env.D1_DATABASE
    .prepare(`
      SELECT oi.*, p.name as product_name, p.product_type
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
      ORDER BY oi.id ASC
    `)
    .bind(cartId)
    .all<{
      id: number
      order_id: number
      product_id: number
      quantity: number
      price: number
      product_name: string
      product_type: string
    }>()

  return {
    id: order.id,
    userId: order.user_id,
    customerEmail: order.customer_email,
    items: (items.results || []).map(item => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      productType: item.product_type,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.quantity * item.price,
    })),
    totalQuantity: order.quantity,
    subtotalAmount: order.subtotal_amount ?? order.amount,
    discountAmount: order.discount_amount,
    totalAmount: order.total_amount ?? order.amount,
    couponCode: order.coupon_code,
    createdAt: order.created_at,
  }
}

