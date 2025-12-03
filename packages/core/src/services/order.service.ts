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

  async createDraftOrder(request: CreateOrderRequest): Promise<Order> {
    const createdAt = Math.floor(Date.now() / 1000)
    const customerData = request.customerData ? JSON.stringify(request.customerData) : null

    // Create order
    const orderResult = await this.db
      .prepare(
        'INSERT INTO orders (user_id, customer_email, customer_data, quantity, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        request.userId || null,
        request.customerEmail,
        customerData,
        request.quantity,
        0, // Amount will be calculated and updated
        'pending',
        createdAt
      )
      .run()

    const orderId = orderResult.meta.last_row_id
    if (!orderId) {
      throw new Error('Failed to create order')
    }

    // Get product price
    const productResult = await this.db
      .prepare('SELECT price FROM products WHERE id = ?')
      .bind(request.productId)
      .first<{ price: number }>()

    if (!productResult) {
      throw new Error('Product not found')
    }

    const totalAmount = productResult.price * request.quantity

    // Update order with calculated amount
    await this.db
      .prepare('UPDATE orders SET amount = ? WHERE id = ?')
      .bind(totalAmount, orderId)
      .run()

    // Create order item
    await this.db
      .prepare(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)'
      )
      .bind(orderId, request.productId, request.quantity, productResult.price)
      .run()

    const order = await this.getById(Number(orderId))
    if (!order) {
      throw new Error('Failed to retrieve created order')
    }

    return order
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

  async updateFulfillmentResult(id: number, result: string): Promise<Order> {
    await this.db
      .prepare('UPDATE orders SET fulfillment_result = ? WHERE id = ?')
      .bind(result, id)
      .run()

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
   */
  async markOrderRefunded(orderId: number): Promise<Order> {
    // Update order status to refunded
    const updated = await this.updateStatus(orderId, 'refunded')

    // Disable downloads by setting expires_at to past (or a flag if we add one)
    // For now, set expires_at to current time to immediately expire downloads
    const now = Math.floor(Date.now() / 1000)
    await this.db
      .prepare('UPDATE downloads SET expires_at = ? WHERE order_id = ? AND (expires_at IS NULL OR expires_at > ?)')
      .bind(now, orderId, now)
      .run()

    return updated
  }
}
