import { Hono } from 'hono'
import type { Env } from '../types'
import { ProductService } from '@dragon/core'
import { getOrCreateCart, generateCartToken, associateCartWithUser, recalculateCartTotal, getCartWithItems } from '../utils/cart'
import { logError, logInfo } from '../utils/logging'
import { formatValidationError, AddCartItemSchema, UpdateCartItemSchema, CartCheckoutSchema } from '../validation/schemas'

export function createCartRouter(env: Env) {
  const router = new Hono<{ Bindings: Env }>()
  const productService = new ProductService(env.D1_DATABASE)

  /**
   * GET /api/cart
   * Get current cart with items
   */
  router.get('/', async (c) => {
    try {
      const userId = c.get('userId') // From customerAuth middleware (if logged in)
      const cartToken = c.req.cookie('cart_token')

      // Get or create cart
      const { cartId } = await getOrCreateCart(
        userId || null,
        cartToken || null,
        null,
        env
      )

      // Get cart with items
      const cart = await getCartWithItems(cartId, env)

      if (!cart) {
        return c.json(makeError(ErrorCodes.NOT_FOUND, 'Cart not found'), 404)
      }

      // Generate new cart token for guest users (refresh expiry)
      let newCartToken: string | undefined
      if (!userId && cartToken) {
        try {
          newCartToken = await generateCartToken(cartId, env)
        } catch (error) {
          // If token generation fails, continue without updating cookie
        }
      }

      const response = c.json({ data: cart }, 200)

      // Set cart token cookie for guest users
      if (newCartToken) {
        response.headers.set(
          'Set-Cookie',
          `cart_token=${newCartToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`
        )
      }

      return response
    } catch (error) {
      logError('Error fetching cart', error, {}, env)
      return c.json(makeError(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch cart'), 500)
    }
  })

  /**
   * POST /api/cart/items
   * Add or update item in cart
   */
  router.post('/items', async (c) => {
    try {
      const userId = c.get('userId') // From customerAuth middleware (if logged in)
      const cartToken = c.req.cookie('cart_token')
      const body = await c.req.json()

      // Validate input
      const validationResult = AddCartItemSchema.safeParse(body)
      if (!validationResult.success) {
        return c.json(formatValidationError(validationResult.error), 400)
      }

      const { productId, quantity } = validationResult.data

      // Verify product exists and is active
      const product = await productService.getById(productId)
      if (!product || product.isActive === 0) {
        return c.json(makeError(ErrorCodes.NOT_FOUND, 'Product not found or inactive'), 404)
      }

      // Check stock if applicable
      if (product.stock !== null && product.stock < quantity) {
        return c.json(makeError(ErrorCodes.INSUFFICIENT_STOCK, 'Insufficient stock'), 400)
      }

      // Get or create cart
      const { cartId, isNew } = await getOrCreateCart(
        userId || null,
        cartToken || null,
        null,
        env
      )

      // Check if item already exists in cart
      const existingItem = await env.D1_DATABASE
        .prepare('SELECT id, quantity FROM order_items WHERE order_id = ? AND product_id = ?')
        .bind(cartId, productId)
        .first<{ id: number; quantity: number }>()

      if (existingItem) {
        // Update quantity
        const newQuantity = existingItem.quantity + quantity
        await env.D1_DATABASE
          .prepare('UPDATE order_items SET quantity = ? WHERE id = ?')
          .bind(newQuantity, existingItem.id)
          .run()
      } else {
        // Add new item
        await env.D1_DATABASE
          .prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)')
          .bind(cartId, productId, quantity, product.price)
          .run()
      }

      // Recalculate cart total
      await recalculateCartTotal(cartId, env)

      // Get updated cart
      const cart = await getCartWithItems(cartId, env)

      // Generate cart token for guest users
      let newCartToken: string | undefined
      if (!userId) {
        try {
          newCartToken = await generateCartToken(cartId, env)
        } catch (error) {
          // Continue even if token generation fails
        }
      }

      const response = c.json({ data: cart }, 200)

      // Set cart token cookie for guest users
      if (newCartToken) {
        response.headers.set(
          'Set-Cookie',
          `cart_token=${newCartToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`
        )
      }

      logInfo('Item added to cart', { cartId, productId, quantity, userId }, env)
      return response
    } catch (error) {
      logError('Error adding item to cart', error, {}, env)
      return c.json(makeError(ErrorCodes.INTERNAL_ERROR, 'Failed to add item to cart'), 500)
    }
  })

  /**
   * PUT /api/cart/items/:itemId
   * Update item quantity in cart
   */
  router.put('/items/:itemId', async (c) => {
    try {
      const userId = c.get('userId')
      const cartToken = c.req.cookie('cart_token')
      const itemId = parseInt(c.req.param('itemId'), 10)
      const body = await c.req.json()

      // Validate input
      const validationResult = UpdateCartItemSchema.safeParse(body)
      if (!validationResult.success) {
        return c.json(formatValidationError(validationResult.error), 400)
      }

      const { quantity } = validationResult.data

      // Get cart ID
      const { cartId } = await getOrCreateCart(
        userId || null,
        cartToken || null,
        null,
        env
      )

      // Verify item belongs to cart
      const item = await env.D1_DATABASE
        .prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?')
        .bind(itemId, cartId)
        .first<{ id: number; product_id: number }>()

      if (!item) {
        return c.json(makeError(ErrorCodes.NOT_FOUND, 'Item not found in cart'), 404)
      }

      // Check product stock if applicable
      const product = await productService.getById(item.product_id)
      if (product && product.stock !== null && product.stock < quantity) {
        return c.json(makeError(ErrorCodes.INSUFFICIENT_STOCK, 'Insufficient stock'), 400)
      }

      // Update quantity
      await env.D1_DATABASE
        .prepare('UPDATE order_items SET quantity = ? WHERE id = ?')
        .bind(quantity, itemId)
        .run()

      // Recalculate cart total
      await recalculateCartTotal(cartId, env)

      // Get updated cart
      const cart = await getCartWithItems(cartId, env)

      return c.json({ data: cart }, 200)
    } catch (error) {
      logError('Error updating cart item', error, {}, env)
      return c.json(makeError(ErrorCodes.INTERNAL_ERROR, 'Failed to update cart item'), 500)
    }
  })

  /**
   * DELETE /api/cart/items/:itemId
   * Remove item from cart
   */
  router.delete('/items/:itemId', async (c) => {
    try {
      const userId = c.get('userId')
      const cartToken = c.req.cookie('cart_token')
      const itemId = parseInt(c.req.param('itemId'), 10)

      // Get cart ID
      const { cartId } = await getOrCreateCart(
        userId || null,
        cartToken || null,
        null,
        env
      )

      // Verify item belongs to cart
      const item = await env.D1_DATABASE
        .prepare('SELECT id FROM order_items WHERE id = ? AND order_id = ?')
        .bind(itemId, cartId)
        .first<{ id: number }>()

      if (!item) {
        return c.json(makeError(ErrorCodes.NOT_FOUND, 'Item not found in cart'), 404)
      }

      // Delete item
      await env.D1_DATABASE
        .prepare('DELETE FROM order_items WHERE id = ?')
        .bind(itemId)
        .run()

      // Recalculate cart total
      await recalculateCartTotal(cartId, env)

      // Get updated cart
      const cart = await getCartWithItems(cartId, env)

      logInfo('Item removed from cart', { cartId, itemId, userId }, env)
      return c.json({ data: cart }, 200)
    } catch (error) {
      logError('Error removing item from cart', error, {}, env)
      return c.json(makeError(ErrorCodes.INTERNAL_ERROR, 'Failed to remove item from cart'), 500)
    }
  })

  /**
   * POST /api/cart/checkout
   * Convert cart to pending order
   */
  router.post('/checkout', async (c) => {
    try {
      const userId = c.get('userId')
      const cartToken = c.req.cookie('cart_token')
      const body = await c.req.json()

      // Validate input
      const validationResult = CartCheckoutSchema.safeParse(body)
      if (!validationResult.success) {
        return c.json(formatValidationError(validationResult.error), 400)
      }

      // Validate customer email (required for checkout)
      const customerEmail = validationResult.data.customerEmail || (userId ? null : undefined)
      if (!customerEmail && !userId) {
        return c.json(makeError(ErrorCodes.BAD_REQUEST, 'Customer email is required for guest checkout'), 400)
      }

      // Get cart
      const { cartId } = await getOrCreateCart(
        userId || null,
        cartToken || null,
        customerEmail || null,
        env
      )

      const cart = await getCartWithItems(cartId, env)
      if (!cart) {
        return c.json(makeError(ErrorCodes.NOT_FOUND, 'Cart not found'), 404)
      }

      if (cart.items.length === 0) {
        return c.json(makeError(ErrorCodes.BAD_REQUEST, 'Cart is empty'), 400)
      }

      // Recalculate total to ensure accuracy (if no coupon applied)
      if (!cart.couponCode) {
        await recalculateCartTotal(cartId, env)
      }
      
      const updatedCart = await getCartWithItems(cartId, env)
      if (!updatedCart) {
        return c.json(makeError(ErrorCodes.NOT_FOUND, 'Cart not found'), 404)
      }

      // Use total_amount if available, otherwise calculate from items
      const finalAmount = updatedCart.totalAmount ?? updatedCart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
      const subtotal = updatedCart.subtotalAmount ?? updatedCart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)

      // Convert cart to pending order
      const finalEmail = userId ? (await env.D1_DATABASE
        .prepare('SELECT email FROM users WHERE id = ?')
        .bind(userId)
        .first<{ email: string }>())?.email || customerEmail : customerEmail

      // Update order with final amounts and status
      await env.D1_DATABASE
        .prepare('UPDATE orders SET status = ?, customer_email = ?, amount = ?, subtotal_amount = ?, total_amount = ? WHERE id = ?')
        .bind('pending', finalEmail || 'guest@example.com', finalAmount, subtotal, finalAmount, cartId)
        .run()
      
      // If coupon was applied, increment usage
      if (updatedCart.couponCode) {
        const couponService = new CouponService(env.D1_DATABASE)
        const coupon = await couponService.getCouponByCode(updatedCart.couponCode)
        if (coupon) {
          await couponService.incrementCouponUsage(coupon.id, userId)
        }
      }

      // Clear cart token cookie
      const response = c.json({
        data: {
          orderId: cartId,
          message: 'Cart converted to order',
        },
      }, 200)

      response.headers.set(
        'Set-Cookie',
        'cart_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
      )

      logInfo('Cart converted to order', { cartId, userId, customerEmail: finalEmail }, env)
      return response
    } catch (error) {
      logError('Error checking out cart', error, {}, env)
      return c.json(makeError(ErrorCodes.INTERNAL_ERROR, 'Failed to checkout cart'), 500)
    }
  })

  // Apply coupon to cart
  router.post('/apply-coupon', async (c) => {
    try {
      const body = await c.req.json()

      const validationResult = ApplyCouponSchema.safeParse(body)
      if (!validationResult.success) {
        return c.json(formatValidationError(validationResult.error), 400)
      }

      const { code } = validationResult.data
      const userId = c.get('userId') || null
      const cartToken = c.req.cookie('cart_token')
      
      // Get customer email from user if logged in, or from cart
      let customerEmail = ''
      if (userId) {
        const user = await env.D1_DATABASE
          .prepare('SELECT email FROM users WHERE id = ?')
          .bind(userId)
          .first<{ email: string }>()
        customerEmail = user?.email || ''
      } else {
        // For guests, we'll get email from cart or use placeholder
        customerEmail = 'guest@example.com'
      }

      // Get or create cart
      const { cartId } = await getOrCreateCart(userId, cartToken, customerEmail, env)
      const cart = await getCartWithItems(cartId, env)
      if (!cart) {
        return c.json(makeError(ErrorCodes.NOT_FOUND, 'Cart not found'), 404)
      }

      // Check if cart is empty
      if (!cart.items || cart.items.length === 0) {
        return c.json(makeError(ErrorCodes.BAD_REQUEST, 'Cart is empty'), 400)
      }

      // Calculate subtotal from items
      const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)

      // Get coupon
      const couponService = new CouponService(env.D1_DATABASE)
      const coupon = await couponService.getCouponByCode(code)
      if (!coupon) {
        return c.json(makeError(ErrorCodes.NOT_FOUND, 'Invalid coupon code'), 404)
      }

      // Create order object for validation
      const orderForValidation = {
        id: cart.id,
        userId: cart.userId,
        customerEmail: cart.customerEmail,
        quantity: cart.totalQuantity,
        amount: subtotal,
        discountAmount: 0,
        subtotalAmount: subtotal,
        status: 'cart' as const,
        createdAt: cart.createdAt,
      }

      // Validate coupon
      const validation = await couponService.validateCouponForCart({
        coupon,
        order: orderForValidation,
        userId,
      })

      if (!validation.valid) {
        return c.json(makeError(ErrorCodes.BAD_REQUEST, validation.reason || 'Coupon is not valid'), 400)
      }

      // Apply coupon
      const { discount, total } = couponService.applyCouponToAmount(subtotal, coupon)

      // Update cart order with coupon info
      await env.D1_DATABASE
        .prepare(
          'UPDATE orders SET coupon_code = ?, discount_amount = ?, subtotal_amount = ?, total_amount = ? WHERE id = ?'
        )
        .bind(coupon.code, discount, subtotal, total, cart.id)
        .run()

      // Get updated cart
      const updatedCart = await getCartWithItems(cart.id, env)

      return c.json({ data: updatedCart })
    } catch (error: any) {
      console.error('Error applying coupon:', error)
      return c.json(makeError(ErrorCodes.INTERNAL_ERROR, 'Failed to apply coupon'), 500)
    }
  })

  // Remove coupon from cart
  router.delete('/remove-coupon', async (c) => {
    try {
      const userId = c.get('userId') || null
      const cartToken = c.req.cookie('cart_token')
      
      // Get customer email
      let customerEmail = ''
      if (userId) {
        const user = await env.D1_DATABASE
          .prepare('SELECT email FROM users WHERE id = ?')
          .bind(userId)
          .first<{ email: string }>()
        customerEmail = user?.email || ''
      } else {
        customerEmail = 'guest@example.com'
      }

      // Get cart
      const { cartId } = await getOrCreateCart(userId, cartToken, customerEmail, env)
      const cart = await getCartWithItems(cartId, env)
      if (!cart) {
        return c.json(makeError(ErrorCodes.NOT_FOUND, 'Cart not found'), 404)
      }

      // Recalculate total from items (subtotal = total when no coupon)
      const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)

      // Clear coupon and update amounts
      await env.D1_DATABASE
        .prepare(
          'UPDATE orders SET coupon_code = NULL, discount_amount = 0, subtotal_amount = ?, total_amount = ? WHERE id = ?'
        )
        .bind(subtotal, subtotal, cart.id)
        .run()

      // Get updated cart
      const updatedCart = await getCartWithItems(cart.id, env)

      return c.json({ data: updatedCart })
    } catch (error: any) {
      console.error('Error removing coupon:', error)
      return c.json(makeError(ErrorCodes.INTERNAL_ERROR, 'Failed to remove coupon'), 500)
    }
  })

  return router
}

