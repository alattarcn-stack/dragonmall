import type { Payment, CreatePaymentRequest, Refund } from '../types'
import type { D1Database } from '@cloudflare/workers-types'

export class PaymentService {
  constructor(private db: D1Database) {}

  async getById(id: number): Promise<Payment | null> {
    const result = await this.db
      .prepare('SELECT * FROM payments WHERE id = ?')
      .bind(id)
      .first<{
        id: number
        transaction_number: string
        external_transaction_id: string | null
        user_id: number | null
        order_id: number | null
        product_id: number | null
        amount: number
        currency: string
        method: string
        status: string
        payment_method_type: string | null
        metadata: string | null
        ip_address: string | null
        created_at: number
        paid_at: number | null
      }>()

    if (!result) {
      return null
    }

    return {
      id: result.id,
      transactionNumber: result.transaction_number,
      externalTransactionId: result.external_transaction_id,
      userId: result.user_id,
      orderId: result.order_id,
      productId: result.product_id,
      amount: result.amount,
      currency: result.currency,
      method: result.method as 'stripe' | 'paypal',
      status: result.status as Payment['status'],
      paymentMethodType: result.payment_method_type,
      metadata: result.metadata,
      ipAddress: result.ip_address,
      createdAt: result.created_at,
      paidAt: result.paid_at,
    }
  }

  async getByTransactionNumber(transactionNumber: string): Promise<Payment | null> {
    const result = await this.db
      .prepare('SELECT * FROM payments WHERE transaction_number = ?')
      .bind(transactionNumber)
      .first<Payment>()

    return result || null
  }

  async getByOrderId(orderId: number): Promise<Payment | null> {
    const result = await this.db
      .prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1')
      .bind(orderId)
      .first<{
        id: number
        transaction_number: string
        external_transaction_id: string | null
        user_id: number | null
        order_id: number | null
        product_id: number | null
        amount: number
        currency: string
        method: string
        status: string
        payment_method_type: string | null
        metadata: string | null
        ip_address: string | null
        created_at: number
        paid_at: number | null
      }>()

    if (!result) {
      return null
    }

    return {
      id: result.id,
      transactionNumber: result.transaction_number,
      externalTransactionId: result.external_transaction_id,
      userId: result.user_id,
      orderId: result.order_id,
      productId: result.product_id,
      amount: result.amount,
      currency: result.currency,
      method: result.method as 'stripe' | 'paypal',
      status: result.status as Payment['status'],
      paymentMethodType: result.payment_method_type,
      metadata: result.metadata,
      ipAddress: result.ip_address,
      createdAt: result.created_at,
      paidAt: result.paid_at,
    }
  }

  async createPaymentIntent(request: CreatePaymentRequest): Promise<Payment> {
    // Get order to get authoritative amount from database
    // Always use total_amount if available (includes discounts), otherwise fall back to amount
    const orderResult = await this.db
      .prepare('SELECT amount, total_amount, user_id FROM orders WHERE id = ?')
      .bind(request.orderId)
      .first<{ amount: number; total_amount: number | null; user_id: number | null }>()

    if (!orderResult) {
      throw new Error('Order not found')
    }

    // Use total_amount if available (includes discounts), otherwise use amount
    const orderAmount = orderResult.total_amount ?? orderResult.amount

    const createdAt = Math.floor(Date.now() / 1000)
    const transactionNumber = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const currency = request.currency || 'usd'

    const result = await this.db
      .prepare(
        'INSERT INTO payments (transaction_number, user_id, order_id, amount, currency, method, status, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        transactionNumber,
        orderResult.user_id || null,
        request.orderId,
        orderAmount, // Use authoritative amount from database
        currency,
        request.method,
        'unpaid',
        request.ipAddress || null,
        createdAt
      )
      .run()

    const id = result.meta.last_row_id
    if (!id) {
      throw new Error('Failed to create payment')
    }

    return {
      id: Number(id),
      transactionNumber,
      userId: orderResult.user_id || null,
      orderId: request.orderId,
      amount: orderAmount, // Return authoritative amount
      currency,
      method: request.method,
      status: 'unpaid',
      createdAt,
    }
  }

  async updateExternalTransactionId(
    transactionNumber: string,
    externalTransactionId: string
  ): Promise<void> {
    await this.db
      .prepare(
        'UPDATE payments SET external_transaction_id = ? WHERE transaction_number = ?'
      )
      .bind(externalTransactionId, transactionNumber)
      .run()
  }

  async updatePaymentStatus(
    transactionNumber: string,
    status: 'unpaid' | 'paid' | 'refunded' | 'failed'
  ): Promise<void> {
    await this.db
      .prepare('UPDATE payments SET status = ? WHERE transaction_number = ?')
      .bind(status, transactionNumber)
      .run()
  }

  async getByExternalTransactionId(externalTransactionId: string): Promise<Payment | null> {
    const result = await this.db
      .prepare('SELECT * FROM payments WHERE external_transaction_id = ?')
      .bind(externalTransactionId)
      .first<{
        id: number
        transaction_number: string
        external_transaction_id: string | null
        user_id: number | null
        order_id: number | null
        product_id: number | null
        amount: number
        currency: string
        method: string
        status: string
        payment_method_type: string | null
        metadata: string | null
        ip_address: string | null
        created_at: number
        paid_at: number | null
      }>()

    if (!result) {
      return null
    }

    return {
      id: result.id,
      transactionNumber: result.transaction_number,
      externalTransactionId: result.external_transaction_id,
      userId: result.user_id,
      orderId: result.order_id,
      productId: result.product_id,
      amount: result.amount,
      currency: result.currency,
      method: result.method as 'stripe' | 'paypal',
      status: result.status as Payment['status'],
      paymentMethodType: result.payment_method_type,
      metadata: result.metadata,
      ipAddress: result.ip_address,
      createdAt: result.created_at,
      paidAt: result.paid_at,
    }
  }

  async getAll(): Promise<Payment[]> {
    const result = await this.db
      .prepare('SELECT * FROM payments ORDER BY created_at DESC')
      .all<Payment>()

    return result.results || []
  }

  async confirmPayment(
    transactionNumber: string,
    externalTransactionId?: string
  ): Promise<Payment> {
    const paidAt = Math.floor(Date.now() / 1000)

    await this.db
      .prepare(
        'UPDATE payments SET status = ?, external_transaction_id = ?, paid_at = ? WHERE transaction_number = ?'
      )
      .bind('paid', externalTransactionId || null, paidAt, transactionNumber)
      .run()

    const payment = await this.getByTransactionNumber(transactionNumber)
    if (!payment) {
      throw new Error('Payment not found')
    }

    return payment
  }

  async getByPaymentId(paymentId: number): Promise<Payment | null> {
    return this.getById(paymentId)
  }

  /**
   * Create a refund for a payment
   * This method handles the provider-specific refund logic and creates a refund record
   * Note: This method requires Stripe/PayPal client instances to be passed in
   * For now, we'll create a simpler version that can be called from the API route
   */
  async createRefundRecord(
    paymentId: number,
    orderId: number,
    amount: number,
    currency: string,
    provider: 'stripe' | 'paypal',
    providerRefundId: string | null,
    status: 'pending' | 'succeeded' | 'failed',
    reason?: string | null
  ): Promise<Refund> {
    const createdAt = Math.floor(Date.now() / 1000)

    const result = await this.db
      .prepare(
        'INSERT INTO refunds (payment_id, order_id, amount, currency, provider, provider_refund_id, status, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(paymentId, orderId, amount, currency, provider, providerRefundId, status, reason || null, createdAt)
      .run()

    const id = result.meta.last_row_id
    if (!id) {
      throw new Error('Failed to create refund record')
    }

    const refund = await this.db
      .prepare('SELECT * FROM refunds WHERE id = ?')
      .bind(id)
      .first<{
        id: number
        payment_id: number
        order_id: number
        amount: number
        currency: string
        provider: string
        provider_refund_id: string | null
        status: string
        reason: string | null
        created_at: number
      }>()

    if (!refund) {
      throw new Error('Failed to retrieve created refund')
    }

    return {
      id: refund.id,
      paymentId: refund.payment_id,
      orderId: refund.order_id,
      amount: refund.amount,
      currency: refund.currency,
      provider: refund.provider as 'stripe' | 'paypal',
      providerRefundId: refund.provider_refund_id,
      status: refund.status as 'pending' | 'succeeded' | 'failed',
      reason: refund.reason,
      createdAt: refund.created_at,
    }
  }

  /**
   * Get refunds for a payment
   */
  async getRefundsByPaymentId(paymentId: number): Promise<Refund[]> {
    const result = await this.db
      .prepare('SELECT * FROM refunds WHERE payment_id = ? ORDER BY created_at DESC')
      .bind(paymentId)
      .all<{
        id: number
        payment_id: number
        order_id: number
        amount: number
        currency: string
        provider: string
        provider_refund_id: string | null
        status: string
        reason: string | null
        created_at: number
      }>()

    return (result.results || []).map((row) => ({
      id: row.id,
      paymentId: row.payment_id,
      orderId: row.order_id,
      amount: row.amount,
      currency: row.currency,
      provider: row.provider as 'stripe' | 'paypal',
      providerRefundId: row.provider_refund_id,
      status: row.status as 'pending' | 'succeeded' | 'failed',
      reason: row.reason,
      createdAt: row.created_at,
    }))
  }

  /**
   * Get refunds for an order
   */
  async getRefundsByOrderId(orderId: number): Promise<Refund[]> {
    const result = await this.db
      .prepare('SELECT * FROM refunds WHERE order_id = ? ORDER BY created_at DESC')
      .bind(orderId)
      .all<{
        id: number
        payment_id: number
        order_id: number
        amount: number
        currency: string
        provider: string
        provider_refund_id: string | null
        status: string
        reason: string | null
        created_at: number
      }>()

    return (result.results || []).map((row) => ({
      id: row.id,
      paymentId: row.payment_id,
      orderId: row.order_id,
      amount: row.amount,
      currency: row.currency,
      provider: row.provider as 'stripe' | 'paypal',
      providerRefundId: row.provider_refund_id,
      status: row.status as 'pending' | 'succeeded' | 'failed',
      reason: row.reason,
      createdAt: row.created_at,
    }))
  }
}
