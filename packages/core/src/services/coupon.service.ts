import type { D1Database } from '@cloudflare/workers-types'
import type { Coupon, Order } from '../types'

export class CouponService {
  constructor(private db: D1Database) {}

  /**
   * Get coupon by code (case-insensitive lookup, returns uppercase)
   */
  async getCouponByCode(code: string): Promise<Coupon | null> {
    const upperCode = code.toUpperCase().trim()
    
    const result = await this.db
      .prepare('SELECT * FROM coupons WHERE code = ?')
      .bind(upperCode)
      .first<{
        id: number
        code: string
        type: string
        amount: number
        currency: string | null
        max_uses: number | null
        used_count: number
        per_user_limit: number | null
        min_order_amount: number | null
        starts_at: number | null
        ends_at: number | null
        is_active: number
        created_at: number
        updated_at: number
      }>()

    if (!result) {
      return null
    }

    return {
      id: result.id,
      code: result.code,
      type: result.type as 'percentage' | 'fixed',
      amount: result.amount,
      currency: result.currency,
      maxUses: result.max_uses,
      usedCount: result.used_count,
      perUserLimit: result.per_user_limit,
      minOrderAmount: result.min_order_amount,
      startsAt: result.starts_at,
      endsAt: result.ends_at,
      isActive: result.is_active,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }
  }

  /**
   * Validate coupon for cart/order
   */
  async validateCouponForCart(args: {
    coupon: Coupon
    order: Order
    userId?: number | null
  }): Promise<{ valid: boolean; reason?: string }> {
    const { coupon, order, userId } = args

    // Check if coupon is active
    if (coupon.isActive === 0) {
      return { valid: false, reason: 'Coupon is not active' }
    }

    // Check date window
    const now = Math.floor(Date.now() / 1000)
    if (coupon.startsAt && now < coupon.startsAt) {
      return { valid: false, reason: 'Coupon has not started yet' }
    }
    if (coupon.endsAt && now > coupon.endsAt) {
      return { valid: false, reason: 'Coupon has expired' }
    }

    // Check max uses
    if (coupon.maxUses !== null && coupon.maxUses !== undefined) {
      if (coupon.usedCount >= coupon.maxUses) {
        return { valid: false, reason: 'Coupon has reached maximum uses' }
      }
    }

    // Check per user limit
    if (userId && coupon.perUserLimit !== null && coupon.perUserLimit !== undefined) {
      const userUsageCount = await this.getUserCouponUsageCount(coupon.id, userId)
      if (userUsageCount >= coupon.perUserLimit) {
        return { valid: false, reason: 'You have reached the maximum uses for this coupon' }
      }
    }

    // Check minimum order amount
    const orderSubtotal = order.subtotalAmount ?? order.amount
    if (coupon.minOrderAmount !== null && coupon.minOrderAmount !== undefined) {
      if (orderSubtotal < coupon.minOrderAmount) {
        return {
          valid: false,
          reason: `Minimum order amount of $${(coupon.minOrderAmount / 100).toFixed(2)} required`,
        }
      }
    }

    return { valid: true }
  }

  /**
   * Get user's usage count for a coupon
   */
  private async getUserCouponUsageCount(couponId: number, userId: number): Promise<number> {
    const result = await this.db
      .prepare(
        'SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND coupon_code = (SELECT code FROM coupons WHERE id = ?) AND status IN (?, ?, ?)'
      )
      .bind(userId, couponId, 'completed', 'processing', 'pending')
      .first<{ count: number }>()

    return result?.count || 0
  }

  /**
   * Apply coupon to amount and calculate discount + total
   */
  applyCouponToAmount(amount: number, coupon: Coupon): { discount: number; total: number } {
    let discount = 0

    if (coupon.type === 'percentage') {
      // Percentage discount: discount = floor(amount * (coupon.amount / 100))
      discount = Math.floor((amount * coupon.amount) / 100)
      // Ensure discount doesn't exceed amount
      discount = Math.min(discount, amount)
    } else if (coupon.type === 'fixed') {
      // Fixed discount: discount = min(coupon.amount, amount)
      discount = Math.min(coupon.amount, amount)
    }

    const total = Math.max(0, amount - discount)

    return { discount, total }
  }

  /**
   * Increment coupon usage count
   */
  async incrementCouponUsage(couponId: number, userId?: number | null): Promise<void> {
    const now = Math.floor(Date.now() / 1000)
    
    await this.db
      .prepare('UPDATE coupons SET used_count = used_count + 1, updated_at = ? WHERE id = ?')
      .bind(now, couponId)
      .run()
  }

  /**
   * Get coupon by ID
   */
  async getCouponById(id: number): Promise<Coupon | null> {
    const result = await this.db
      .prepare('SELECT * FROM coupons WHERE id = ?')
      .bind(id)
      .first<{
        id: number
        code: string
        type: string
        amount: number
        currency: string | null
        max_uses: number | null
        used_count: number
        per_user_limit: number | null
        min_order_amount: number | null
        starts_at: number | null
        ends_at: number | null
        is_active: number
        created_at: number
        updated_at: number
      }>()

    if (!result) {
      return null
    }

    return {
      id: result.id,
      code: result.code,
      type: result.type as 'percentage' | 'fixed',
      amount: result.amount,
      currency: result.currency,
      maxUses: result.max_uses,
      usedCount: result.used_count,
      perUserLimit: result.per_user_limit,
      minOrderAmount: result.min_order_amount,
      startsAt: result.starts_at,
      endsAt: result.ends_at,
      isActive: result.is_active,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }
  }

  /**
   * List all coupons
   */
  async listCoupons(options?: { includeInactive?: boolean }): Promise<Coupon[]> {
    let query = 'SELECT * FROM coupons'
    const params: any[] = []

    if (!options?.includeInactive) {
      query += ' WHERE is_active = ?'
      params.push(1)
    }

    query += ' ORDER BY created_at DESC'

    const result = await this.db.prepare(query).bind(...params).all<{
      id: number
      code: string
      type: string
      amount: number
      currency: string | null
      max_uses: number | null
      used_count: number
      per_user_limit: number | null
      min_order_amount: number | null
      starts_at: number | null
      ends_at: number | null
      is_active: number
      created_at: number
      updated_at: number
    }>()

    return (result.results || []).map((row) => ({
      id: row.id,
      code: row.code,
      type: row.type as 'percentage' | 'fixed',
      amount: row.amount,
      currency: row.currency,
      maxUses: row.max_uses,
      usedCount: row.used_count,
      perUserLimit: row.per_user_limit,
      minOrderAmount: row.min_order_amount,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }

  /**
   * Create a new coupon
   */
  async createCoupon(input: {
    code: string
    type: 'percentage' | 'fixed'
    amount: number
    currency?: string | null
    maxUses?: number | null
    perUserLimit?: number | null
    minOrderAmount?: number | null
    startsAt?: number | null
    endsAt?: number | null
    isActive?: boolean
  }): Promise<Coupon> {
    const now = Math.floor(Date.now() / 1000)
    const code = input.code.toUpperCase().trim()
    const isActive = input.isActive !== false ? 1 : 0

    const result = await this.db
      .prepare(
        'INSERT INTO coupons (code, type, amount, currency, max_uses, per_user_limit, min_order_amount, starts_at, ends_at, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        code,
        input.type,
        input.amount,
        input.currency || null,
        input.maxUses ?? null,
        input.perUserLimit ?? null,
        input.minOrderAmount ?? null,
        input.startsAt ?? null,
        input.endsAt ?? null,
        isActive,
        now,
        now
      )
      .run()

    const id = result.meta.last_row_id
    if (!id) {
      throw new Error('Failed to create coupon')
    }

    const coupon = await this.getCouponById(Number(id))
    if (!coupon) {
      throw new Error('Failed to retrieve created coupon')
    }

    return coupon
  }

  /**
   * Update a coupon
   */
  async updateCoupon(
    id: number,
    input: Partial<{
      code: string
      type: 'percentage' | 'fixed'
      amount: number
      currency: string | null
      maxUses: number | null
      perUserLimit: number | null
      minOrderAmount: number | null
      startsAt: number | null
      endsAt: number | null
      isActive: boolean
    }>
  ): Promise<Coupon> {
    const existing = await this.getCouponById(id)
    if (!existing) {
      throw new Error('Coupon not found')
    }

    const updates: string[] = []
    const values: any[] = []

    if (input.code !== undefined) {
      updates.push('code = ?')
      values.push(input.code.toUpperCase().trim())
    }
    if (input.type !== undefined) {
      updates.push('type = ?')
      values.push(input.type)
    }
    if (input.amount !== undefined) {
      updates.push('amount = ?')
      values.push(input.amount)
    }
    if (input.currency !== undefined) {
      updates.push('currency = ?')
      values.push(input.currency)
    }
    if (input.maxUses !== undefined) {
      updates.push('max_uses = ?')
      values.push(input.maxUses)
    }
    if (input.perUserLimit !== undefined) {
      updates.push('per_user_limit = ?')
      values.push(input.perUserLimit)
    }
    if (input.minOrderAmount !== undefined) {
      updates.push('min_order_amount = ?')
      values.push(input.minOrderAmount)
    }
    if (input.startsAt !== undefined) {
      updates.push('starts_at = ?')
      values.push(input.startsAt)
    }
    if (input.endsAt !== undefined) {
      updates.push('ends_at = ?')
      values.push(input.endsAt)
    }
    if (input.isActive !== undefined) {
      updates.push('is_active = ?')
      values.push(input.isActive ? 1 : 0)
    }

    if (updates.length === 0) {
      return existing
    }

    updates.push('updated_at = ?')
    values.push(Math.floor(Date.now() / 1000))
    values.push(id)

    await this.db
      .prepare(`UPDATE coupons SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run()

    const updated = await this.getCouponById(id)
    if (!updated) {
      throw new Error('Failed to retrieve updated coupon')
    }

    return updated
  }

  /**
   * Delete a coupon
   */
  async deleteCoupon(id: number): Promise<void> {
    const result = await this.db.prepare('DELETE FROM coupons WHERE id = ?').bind(id).run()

    if (result.meta.changes === 0) {
      throw new Error('Coupon not found')
    }
  }
}

