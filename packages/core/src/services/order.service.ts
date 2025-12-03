import type { Order, OrderItem, CreateOrderRequest } from '../types'
import type { D1Database } from '@cloudflare/workers-types'

export class OrderService {
  constructor(private db: D1Database) {}

  async getById(id: number): Promise<Order | null> {
    const result = await this.db
      .prepare('SELECT * FROM orders WHERE id = ?')
      .bind(id)
      .first<{
        id: number
        user_id: number | null
        customer_email: string
        customer_data: string | null
        quantity: number
        amount: number
        coupon_code: string | null
        discount_amount: number
        subtotal_amount: number | null
        total_amount: number | null
        status: string
        fulfillment_result: string | null
        created_at: number
        completed_at: number | null
      }>()

    if (!result) {
      return null
    }

    return {
      id: result.id,
      userId: result.user_id,
      customerEmail: result.customer_email,
      customerData: result.customer_data,
      quantity: result.quantity,
      amount: result.amount,
      couponCode: result.coupon_code,
      discountAmount: result.discount_amount,
      subtotalAmount: result.subtotal_amount,
      totalAmount: result.total_amount,
      status: result.status as Order['status'],
      fulfillmentResult: result.fulfillment_result,
      createdAt: result.created_at,
      completedAt: result.completed_at,
    }
  }

  async getByUserId(userId: number): Promise<Order[]> {
    const result = await this.db
      .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC')
      .bind(userId)
      .all<{
        id: number
        user_id: number | null
        customer_email: string
        customer_data: string | null
        quantity: number
        amount: number
        coupon_code: string | null
        discount_amount: number
        subtotal_amount: number | null
        total_amount: number | null
        status: string
        fulfillment_result: string | null
        created_at: number
        completed_at: number | null
      }>()

    return (result.results || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      customerEmail: row.customer_email,
      customerData: row.customer_data,
      quantity: row.quantity,
      amount: row.amount,
      couponCode: row.coupon_code,
      discountAmount: row.discount_amount,
      subtotalAmount: row.subtotal_amount,
      totalAmount: row.total_amount,
      status: row.status as Order['status'],
      fulfillmentResult: row.fulfillment_result,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }))
  }

  async getByEmail(email: string): Promise<Order[]> {
    const result = await this.db
      .prepare('SELECT * FROM orders WHERE customer_email = ? ORDER BY created_at DESC')
      .bind(email)
      .all<{
        id: number
        user_id: number | null
        customer_email: string
        customer_data: string | null
        quantity: number
        amount: number
        coupon_code: string | null
        discount_amount: number
        subtotal_amount: number | null
        total_amount: number | null
        status: string
        fulfillment_result: string | null
        created_at: number
        completed_at: number | null
      }>()

    return (result.results || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      customerEmail: row.customer_email,
      customerData: row.customer_data,
      quantity: row.quantity,
      amount: row.amount,
      couponCode: row.coupon_code,
      discountAmount: row.discount_amount,
      subtotalAmount: row.subtotal_amount,
      totalAmount: row.total_amount,
      status: row.status as Order['status'],
      fulfillmentResult: row.fulfillment_result,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }))
  }

  /**
   * Create a draft order with order items in a transaction-like manner
   * Uses cleanup on failure to prevent orphaned orders
   */
  async createDraftOrder(request: CreateOrderRequest): Promise<Order> {
    const createdAt = Math.floor(Date.now() / 1000)
    const customerData = request.customerData ? JSON.stringify(request.customerData) : null

    // Get product price first (before transaction)
    const productResult = await this.db
      .prepare('SELECT price FROM products WHERE id = ?')
      .bind(request.productId)
      .first<{ price: number }>()

    if (!productResult) {
      throw new Error('Product not found')
    }

    const totalAmount = productResult.price * request.quantity

    // Execute order creation with cleanup on failure
    let orderId: number | undefined
    try {
      // Step 1: Create order
      const orderResult = await this.db
        .prepare(
          'INSERT INTO orders (user_id, customer_email, customer_data, quantity, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          request.userId || null,
          request.customerEmail,
          customerData,
          request.quantity,
          totalAmount,
          'pending',
          createdAt
        )
        .run()

      orderId = Number(orderResult.meta.last_row_id)
      if (!orderId) {
        throw new Error('Failed to create order')
      }

      // Step 2: Create order item
      // If this fails, cleanup will delete the orphaned order
      await this.db
        .prepare(
          'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)'
        )
        .bind(orderId, request.productId, request.quantity, productResult.price)
        .run()

      const order = await this.getById(orderId)
      if (!order) {
        throw new Error('Failed to retrieve created order')
      }

      return order
    } catch (error) {
      // Cleanup: If order_item insertion fails, delete the orphaned order
      if (orderId) {
        try {
          await this.db
            .prepare('DELETE FROM orders WHERE id = ?')
            .bind(orderId)
            .run()
        } catch (cleanupError) {
          // Log but don't throw - the original error is more important
          console.error('Failed to cleanup orphaned order:', cleanupError)
        }
      }
      throw error
    }
  }

  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    const result = await this.db
      .prepare('SELECT * FROM order_items WHERE order_id = ?')
      .bind(orderId)
      .all<OrderItem>()

    return result.results || []
  }

  async updateStatus(id: number, status: Order['status']): Promise<Order> {
    const updates: Partial<Order> = { status }

    if (status === 'completed') {
      updates.completedAt = Math.floor(Date.now() / 1000)
    }

    const existing = await this.getById(id)
    if (!existing) {
      throw new Error('Order not found')
    }

    const updated: Order = { ...existing, ...updates }

    await this.db
      .prepare('UPDATE orders SET status = ?, completed_at = ? WHERE id = ?')
      .bind(
        updated.status,
        updated.completedAt || null,
        id
      )
      .run()

    return updated
  }

  async markPaid(orderId: number): Promise<Order> {
    // Update order status to processing (payment received, now fulfill)
    return this.updateStatus(orderId, 'processing')
  }

  /**
   * Update fulfillment result and status atomically using batch
   */
  async updateFulfillmentResult(id: number, result: string): Promise<Order> {
    // Use batch to update both fields atomically
    await this.db.batch([
      this.db
        .prepare('UPDATE orders SET fulfillment_result = ? WHERE id = ?')
        .bind(result, id),
    ])

    const order = await this.getById(id)
    if (!order) {
      throw new Error('Order not found')
    }

    return order
  }

  /**
   * Fulfill order: update fulfillment result and status atomically
   * This is used in the fulfillment flow
   */
  async fulfillOrder(id: number, fulfillmentResult: string): Promise<Order> {
    const completedAt = Math.floor(Date.now() / 1000)

    // Use batch to update fulfillment result and status atomically
    await this.db.batch([
      this.db
        .prepare('UPDATE orders SET fulfillment_result = ?, status = ?, completed_at = ? WHERE id = ?')
        .bind(fulfillmentResult, 'completed', completedAt, id),
    ])

    const order = await this.getById(id)
    if (!order) {
      throw new Error('Order not found')
    }

    return order
  }

  async getProductById(productId: number): Promise<{ id: number; productType: 'digital' | 'license_code' } | null> {
    const result = await this.db
      .prepare('SELECT id, product_type FROM products WHERE id = ?')
      .bind(productId)
      .first<{ id: number; product_type: string }>()

    if (!result) {
      return null
    }

    return {
      id: result.id,
      productType: result.product_type as 'digital' | 'license_code',
    }
  }

  /**
   * Mark an order as refunded and disable associated downloads
   * Uses batch for atomic updates
   */
  async markOrderRefunded(orderId: number): Promise<Order> {
    const now = Math.floor(Date.now() / 1000)

    // Use batch to update order status and disable downloads atomically
    await this.db.batch([
      this.db
        .prepare('UPDATE orders SET status = ? WHERE id = ?')
        .bind('refunded', orderId),
      this.db
        .prepare('UPDATE downloads SET expires_at = ? WHERE order_id = ? AND (expires_at IS NULL OR expires_at > ?)')
        .bind(now, orderId, now),
    ])

    const order = await this.getById(orderId)
    if (!order) {
      throw new Error('Order not found')
    }

    return order
  }
}
